import type { DerivedStats, SessionRecord, Summarizer } from "../types";
import { derive } from "../core/derive";
import { formatDuration, noteTitle } from "../core/format";

/** How many notes and tags to name in the "Focus" line. */
const TOP_NOTES = 3;
const TOP_TAGS = 3;

/**
 * Offline summary built only from the record's stats. No network, always works,
 * and it's what we fall back to when the Claude API fails.
 *
 * Example: "48m across 6 notes (2 created). Focus: Transformers, Attention, #ml. Followed 3 links."
 */
export class TemplateSummarizer implements Summarizer {
	summarize(record: SessionRecord): Promise<string> {
		// Async only to match the Summarizer interface; the work itself is synchronous.
		return Promise.resolve(renderTemplate(record));
	}
}

export function renderTemplate(record: SessionRecord): string {
	const stats: DerivedStats = record.derived ?? derive(record);
	const duration = formatDuration(record.durationSec ?? 0);
	const noteCount = stats.notesTouched.length;

	if (noteCount === 0) {
		return `${duration} session, no notes touched.`;
	}

	const sentences: string[] = [];

	const createdPart = stats.created.length > 0 ? ` (${stats.created.length} created)` : "";
	sentences.push(`${duration} across ${plural(noteCount, "note")}${createdPart}.`);

	// notesTouched is already sorted by time spent, most first.
	const focus = [
		...stats.notesTouched.slice(0, TOP_NOTES).map(noteTitle),
		...stats.tagsTouched.slice(0, TOP_TAGS),
	];
	sentences.push(`Focus: ${focus.join(", ")}.`);

	if (stats.linksFollowed > 0) {
		sentences.push(`Followed ${plural(stats.linksFollowed, "link")}.`);
	}

	return sentences.join(" ");
}

/** plural(1, "note") → "1 note", plural(3, "note") → "3 notes". */
function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
