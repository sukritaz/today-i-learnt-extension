import type { SessionRecord, SessionSummary } from "../types";
import { TemplateSummarizer } from "./template";

const template = new TemplateSummarizer();

/**
 * The one entry point callers use. It always returns a summary, whichever backend
 * produced it, so main.ts never has to care which one ran.
 *
 * Phase 12 adds the Claude API here: try it when a key is set, and on any
 * error fall back to the template with `fallbackReason` filled in.
 */
export async function summarize(record: SessionRecord, now: Date): Promise<SessionSummary> {
	return {
		backend: "template",
		markdown: await template.summarize(record),
		generatedAt: now.toISOString(),
	};
}
