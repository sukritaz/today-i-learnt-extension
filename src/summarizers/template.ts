import type { DerivedStats, SessionRecord, Summarizer } from "../types";
import { derive } from "../core/derive";
import { formatDuration, wikilink } from "../core/format";

/** Questions in the offline recap. */
const MAX_QUESTIONS = 5;

/**
 * Offline recap built only from the record's stats. No network, always works,
 * and it's what we fall back to when the Claude API fails. It can't read the
 * notes, so its questions come from the path between them.
 *
 * Example:
 *   *48m across 6 notes (2 created), followed 3 links.*
 *   1. How does [[Partitioning]] build on [[Kafka]]?
 *   2. What did you write down in [[Idempotency]], and why?
 */
export class TemplateSummarizer implements Summarizer {
	summarize(record: SessionRecord): Promise<string> {
		// Async only to match the Summarizer interface; the work itself is synchronous.
		return Promise.resolve(renderTemplate(record));
	}
}

export function renderTemplate(record: SessionRecord): string {
	const stats = record.derived ?? derive(record);
	const duration = formatDuration(record.durationSec ?? 0);
	const noteCount = stats.notesTouched.length;

	if (noteCount === 0) {
		return `*${duration} session, no notes touched.*`;
	}

	const created = stats.created.length > 0 ? ` (${stats.created.length} created)` : "";
	const links = stats.linksFollowed > 0 ? `, followed ${plural(stats.linksFollowed, "link")}` : "";
	const overview = `*${duration} across ${plural(noteCount, "note")}${created}${links}.*`;

	const questions = recapQuestions(stats).map((question, index) => `${index + 1}. ${question}`);
	return [overview, ...questions].join("\n");
}

function recapQuestions(stats: DerivedStats): string[] {
	const questions: string[] = [];

	for (const { from, to, viaLink } of stats.transitions) {
		questions.push(
			viaLink
				? `How does ${wikilink(to)} build on ${wikilink(from)}?`
				: `How does ${wikilink(from)} relate to ${wikilink(to)}?`,
		);
	}
	for (const path of stats.created) {
		questions.push(`What did you write down in ${wikilink(path)}, and why?`);
	}
	// A session in one note has no path; ask about the notes studied longest instead.
	if (questions.length === 0) {
		for (const path of stats.notesTouched) {
			questions.push(`Can you explain the main idea of ${wikilink(path)} without looking?`);
		}
	}

	return questions.slice(0, MAX_QUESTIONS);
}

/** plural(1, "note") → "1 note", plural(3, "note") → "3 notes". */
function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}
