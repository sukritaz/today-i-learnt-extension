import type { DerivedStats, SessionRecord } from "../types";
import { derive } from "./derive";
import { formatClock, formatDuration, noteTitle, wikilink } from "./format";

/** Bigger sessions get cut off, so the diagram stays readable. */
const MAX_DIAGRAM_NOTES = 20;
const MAX_CHAIN_NOTES = 40;

export interface BlockOptions {
	/** Show the note counts line under the header. */
	includeStructured: boolean;
}

/**
 * The daily-note block for one session:
 *
 *   %% study-session:start id=... %%
 *   > [!study] Study session · 09:03–09:51 · 48m
 *   > **Notes:** 6 touched, 2 created
 *   >
 *   > **Path**
 *   > ```mermaid
 *   > flowchart LR
 *   > ...
 *   > ```
 *   > [[Kafka]] → [[Partitioning]] → [[Consumer Groups]]
 *   >
 *   > **Grill me**
 *   > <questions, only when Grill me is on>
 *   %% study-session:end %%
 */
export function renderBlock(record: SessionRecord, options: BlockOptions): string {
	const stats = record.derived ?? derive(record);
	const end = record.end ?? record.start;
	const duration = formatDuration(record.durationSec ?? 0);

	const lines = [
		`[!study] Study session · ${formatClock(record.start)}–${formatClock(end)} · ${duration}`,
	];

	if (options.includeStructured) {
		lines.push(`**Notes:** ${stats.notesTouched.length} touched, ${stats.created.length} created`);
	}

	if (stats.visitOrder.length > 0) {
		lines.push("", "**Path**");
		if (stats.transitions.length > 0) lines.push(...renderDiagram(stats));
		lines.push(renderChain(stats.visitOrder));
	}

	const summary = record.summary;
	if (summary) {
		lines.push("", "**Grill me**");
		lines.push(...summary.markdown.trim().split("\n"));
		if (summary.fallbackReason) {
			lines.push("", `*Offline questions used: ${summary.fallbackReason}*`);
		}
	}

	// Every line needs "> " to stay inside the callout, code fences included.
	const callout = lines.map((line) => (line === "" ? ">" : `> ${line}`));
	return [startMarker(record.id), ...callout, END_MARKER].join("\n");
}

/**
 * Mermaid flowchart of how notes were reached. Solid arrows: followed a link.
 * Dotted arrows: got there another way (search, file explorer, quick switcher).
 */
export function renderDiagram(stats: DerivedStats): string[] {
	const shown = stats.visitOrder.slice(0, MAX_DIAGRAM_NOTES);
	const ids = new Map(shown.map((path, index) => [path, `n${index}`]));

	const lines = ["```mermaid", "flowchart LR"];
	for (const [path, id] of ids) {
		lines.push(`    ${id}["${mermaidLabel(noteTitle(path))}"]`);
	}
	for (const { from, to, viaLink } of stats.transitions) {
		const fromId = ids.get(from);
		const toId = ids.get(to);
		if (fromId === undefined || toId === undefined) continue;
		lines.push(`    ${fromId} ${viaLink ? "-->" : "-.->"} ${toId}`);
	}
	// Obsidian makes nodes with this class clickable, opening the note named by the label.
	lines.push(`    class ${[...ids.values()].join(",")} internal-link;`);
	lines.push("```");
	return lines;
}

/** "[[Kafka]] → [[Partitioning]] → ..." in the order notes were first opened. */
export function renderChain(visitOrder: string[]): string {
	const links = visitOrder.slice(0, MAX_CHAIN_NOTES).map(wikilink);
	if (visitOrder.length > MAX_CHAIN_NOTES) {
		links.push(`…${visitOrder.length - MAX_CHAIN_NOTES} more`);
	}
	return links.join(" → ");
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

/** Quotes would end the Mermaid label early; Mermaid's own escape for them is #quot; */
function mermaidLabel(text: string): string {
	return text.replace(/"/g, "#quot;");
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
