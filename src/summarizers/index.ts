import type { SessionRecord, SessionSummary, Summarizer } from "../types";
import { SummaryError } from "./claude";
import { TemplateSummarizer } from "./template";

const template = new TemplateSummarizer();

/**
 * The one entry point callers use. It always returns a summary, whichever backend
 * produced it, so main.ts never has to care which one ran.
 *
 * Pass the Claude summarizer when an API key is set, or null to go straight to the template.
 * If Claude fails for any reason, the template is used and `fallbackReason` says why.
 */
export async function summarize(
	record: SessionRecord,
	now: Date,
	claude: Summarizer | null,
): Promise<SessionSummary> {
	const generatedAt = now.toISOString();

	if (claude) {
		try {
			return { backend: "claude-api", markdown: await claude.summarize(record), generatedAt };
		} catch (error) {
			console.warn("Claude summary failed, using template", error);
			const fallbackReason =
				error instanceof SummaryError ? error.message : "AI summary failed";
			return {
				backend: "template",
				markdown: await template.summarize(record),
				generatedAt,
				fallbackReason,
			};
		}
	}

	return { backend: "template", markdown: await template.summarize(record), generatedAt };
}
