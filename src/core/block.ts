import type { SessionRecord } from "../types";
import { derive } from "./derive";
import { formatClock, formatDuration, noteTitle } from "./format";

/** How many note titles to list on the "Topics" line. */
const TOP_TOPICS = 3;

/**
 * The daily-note block for one session (PRD §8):
 *
 *   %% study-session:start id=... %%
 *   > [!study] Study session · 09:03–09:51 · 48m
 *   > **Topics:** Transformers, Attention
 *   > **Notes:** 6 touched, 2 created
 *   >
 *   > <summary>
 *   %% study-session:end %%
 */
export interface BlockOptions {
	/** Show the "Topics" and "Notes" lines above the summary. */
	includeStructured: boolean;
}

export function renderBlock(record: SessionRecord, options: BlockOptions): string {
	const stats = record.derived ?? derive(record);
	const end = record.end ?? record.start;
	const duration = formatDuration(record.durationSec ?? 0);

	const lines = [
		`[!study] Study session · ${formatClock(record.start)}–${formatClock(end)} · ${duration}`,
	];

	if (options.includeStructured) {
		const topics = stats.notesTouched.slice(0, TOP_TOPICS).map(noteTitle);
		if (topics.length > 0) lines.push(`**Topics:** ${topics.join(", ")}`);
		lines.push(`**Notes:** ${stats.notesTouched.length} touched, ${stats.created.length} created`);
	}

	const summary = record.summary;
	if (summary) {
		// Blank callout line between the stats and the prose, only if there are stats.
		if (lines.length > 1) lines.push("");
		// The summary can be several lines (Claude returns bullets); each needs "> " to stay in the callout.
		lines.push(...summary.markdown.trim().split("\n"));
		if (summary.fallbackReason) {
			lines.push("", `*Template summary used: ${summary.fallbackReason}*`);
		}
	}

	const callout = lines.map((line) => (line === "" ? ">" : `> ${line}`));
	return [startMarker(record.id), ...callout, END_MARKER].join("\n");
}

/**
 * Puts the block into the note text. If a block with the same id is already there,
 * it's replaced in place; otherwise the block is appended at the end.
 * Everything outside our markers is left exactly as it was.
 */
export function upsertBlock(noteText: string, id: string, block: string): string {
	const existing = new RegExp(`${escapeRegExp(startMarker(id))}[\\s\\S]*?${escapeRegExp(END_MARKER)}`);
	if (existing.test(noteText)) {
		// A function replacement, so "$" characters in the summary aren't treated as regex patterns.
		return noteText.replace(existing, () => block);
	}

	if (noteText.trim() === "") return `${block}\n`;
	const withNewline = noteText.endsWith("\n") ? noteText : `${noteText}\n`;
	return `${withNewline}\n${block}\n`;
}

const END_MARKER = "%% study-session:end %%";

function startMarker(id: string): string {
	return `%% study-session:start id=${id} %%`;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
