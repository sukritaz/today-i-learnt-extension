import type { DerivedStats, NoteTransition, SessionEvent, SessionRecord } from "../types";

/** A gap longer than this between opens counts only up to the cap (likely idle). */
const IDLE_CAP_MS = 20 * 60 * 1000;

/**
 * Turns a finished session's raw events into summary stats.
 * Pure: same record in, same stats out.
 */
export function derive(record: SessionRecord): DerivedStats {
	const resolve = buildRenameResolver(record.events);

	// Sets keep insertion order and ignore duplicates.
	const touched = new Set<string>();
	const created = new Set<string>();
	const tags = new Set<string>();
	const timeMs: Record<string, number> = {};
	let linksFollowed = 0;
	const visitOrder: string[] = [];
	const transitions: NoteTransition[] = [];
	const linkPairs = collectLinkPairs(record.events, resolve);

	// The note currently in front of the user, and since when.
	let activePath: string | null = null;
	let activeSince = 0;

	const closeActive = (until: number) => {
		if (activePath === null) return;
		const spent = Math.min(Math.max(until - activeSince, 0), IDLE_CAP_MS);
		timeMs[activePath] = (timeMs[activePath] ?? 0) + spent;
	};

	for (const event of record.events) {
		switch (event.type) {
			case "note.open": {
				const at = toMs(event.ts);
				closeActive(at);
				const path = resolve(event.path);
				// First visit: record where it was reached from. Going back to a note
				// draws no edge; the next new note just branches off it.
				if (!visitOrder.includes(path)) {
					if (activePath !== null && activePath !== path) {
						const viaLink = linkPairs.has(pairKey(activePath, path));
						transitions.push({ from: activePath, to: path, viaLink });
					}
					visitOrder.push(path);
				}
				activePath = path;
				activeSince = at;
				touched.add(path);
				break;
			}
			case "note.modify":
				touched.add(resolve(event.path));
				break;
			case "note.create": {
				const path = resolve(event.path);
				touched.add(path);
				created.add(path);
				break;
			}
			case "note.delete":
				// Created and then deleted in the same session: not really created.
				created.delete(resolve(event.path));
				break;
			case "note.rename":
				// Already handled by resolve(): every path maps to its final name.
				break;
			case "link.follow":
				linksFollowed++;
				break;
			case "tag.touch":
				tags.add(event.tag);
				break;
		}
	}

	const lastEvent = record.events[record.events.length - 1];
	const end = record.end ?? lastEvent?.ts;
	if (end) closeActive(toMs(end));

	const timePerNoteSec: Record<string, number> = {};
	for (const [path, ms] of Object.entries(timeMs)) {
		timePerNoteSec[path] = Math.round(ms / 1000);
	}

	return {
		// Most time first; sort is stable, so ties keep first-touched order.
		notesTouched: [...touched].sort(
			(a, b) => (timePerNoteSec[b] ?? 0) - (timePerNoteSec[a] ?? 0),
		),
		created: [...created],
		timePerNoteSec,
		tagsTouched: [...tags],
		linksFollowed,
		visitOrder,
		transitions,
	};
}

/** Every "followed a link from A to B" pair, with renames applied. */
function collectLinkPairs(events: SessionEvent[], resolve: (path: string) => string): Set<string> {
	const pairs = new Set<string>();
	for (const event of events) {
		if (event.type === "link.follow") pairs.add(pairKey(resolve(event.from), resolve(event.to)));
	}
	return pairs;
}

function pairKey(from: string, to: string): string {
	return `${from}\n${to}`;
}

/** Returns a function that maps any path seen in the session to its final name. */
function buildRenameResolver(events: SessionEvent[]): (path: string) => string {
	const renamedTo = new Map<string, string>();
	for (const event of events) {
		if (event.type === "note.rename") renamedTo.set(event.oldPath, event.path);
	}
	return (path) => {
		let current = path;
		// Follow chains like A → B → C; the bound guards against A → B → A loops.
		for (let i = 0; i <= renamedTo.size; i++) {
			const next = renamedTo.get(current);
			if (next === undefined || next === current) break;
			current = next;
		}
		return current;
	};
}

function toMs(iso: string): number {
	return new Date(iso).getTime();
}
