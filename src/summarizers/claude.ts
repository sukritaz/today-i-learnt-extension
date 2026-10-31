import { App, requestUrl, TFile } from "obsidian";
import type { SessionRecord, Summarizer } from "../types";
import type { TilSettings, Verbosity } from "../settings";
import { derive } from "../core/derive";
import { formatDuration, noteTitle } from "../core/format";
import grillMeSkill from "../../skills/grill-me-study/SKILL.md";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Budget for note content sent to Claude. */
const MAX_NOTES = 10;
const MAX_CHARS_PER_NOTE = 1500;
const MAX_TOTAL_CHARS = 30_000;
/** Notes listed by title in the prompt (no content), so huge sessions stay small. */
const MAX_LISTED_NOTES = 30;

/** Rate limited / overloaded: worth one retry after a short wait. */
const RETRY_STATUSES = [429, 503, 529];
const RETRY_DELAY_MS = 2000;

/**
 * The grill-me-study skill is the system prompt, so the questions follow the same rules
 * as when you use the skill in Claude Code. Its frontmatter is for skill loaders, not the model.
 * The format section is specific to writing questions into the daily note.
 */
const SYSTEM_PROMPT = [
	stripFrontmatter(grillMeSkill).trim(),
	"",
	"## Output format for this request",
	"",
	"This is batch use: the questions are written into the user's daily note.",
	"- First line: one italic sentence naming the thread that connects the topics.",
	"- Then a numbered list of questions.",
	"- Each question names the note it comes from as a [[wikilink]], using the exact title given.",
	"- Markdown only. No answers, no headings, no preamble, no closing remarks.",
].join("\n");

const LENGTH: Record<Verbosity, { questions: string; maxTokens: number }> = {
	short: { questions: "3", maxTokens: 1000 },
	medium: { questions: "5", maxTokens: 1500 },
	long: { questions: "8", maxTokens: 2500 },
};

/** The part of the Messages API response we read. */
interface MessagesResponse {
	content?: { type: string; text?: string }[];
	stop_reason?: string;
}

/** Errors whose message is safe and short enough to show in the daily note. */
export class SummaryError extends Error {}

/**
 * Summarizes a session with the Claude API. Throws SummaryError on any failure;
 * the selector in index.ts catches that and falls back to the template.
 */
export class ClaudeSummarizer implements Summarizer {
	private app: App;
	private getSettings: () => TilSettings;

	constructor(app: App, getSettings: () => TilSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async summarize(record: SessionRecord): Promise<string> {
		const settings = this.getSettings();
		if (!settings.apiKey) throw new SummaryError("no API key set");

		const excerpts = settings.sendNoteContent ? await this.readExcerpts(record) : {};
		const length = LENGTH[settings.verbosity];

		const body = JSON.stringify({
			model: settings.model,
			max_tokens: length.maxTokens,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: buildUserPrompt(record, excerpts, length.questions) }],
		});

		let response = await this.post(body, settings.apiKey);
		if (RETRY_STATUSES.includes(response.status)) {
			await wait(RETRY_DELAY_MS);
			response = await this.post(body, settings.apiKey);
		}

		if (response.status !== 200) throw new SummaryError(describeStatus(response.status));

		const data = response.json as MessagesResponse;
		const text = data.content?.find((block) => block.type === "text")?.text?.trim();
		if (!text) {
			// Only the shape, never the content: enough to tell what went wrong.
			const blocks = data.content?.map((block) => block.type).join(", ") || "none";
			throw new SummaryError(
				`unexpected response from Claude (stop: ${data.stop_reason ?? "?"}, blocks: ${blocks})`,
			);
		}
		return text;
	}

	private async post(body: string, apiKey: string) {
		try {
			return await requestUrl({
				url: API_URL,
				method: "POST",
				// Don't throw on 4xx/5xx; we check the status ourselves.
				throw: false,
				headers: {
					"x-api-key": apiKey,
					"anthropic-version": API_VERSION,
					"content-type": "application/json",
				},
				body,
			});
		} catch {
			// requestUrl still throws when there's no response at all (offline, DNS, timeout).
			// Not passing the original error on: it could include request details.
			throw new SummaryError("couldn't reach the Claude API");
		}
	}

	/** First part of each of the most-studied notes, within the character budget. */
	private async readExcerpts(record: SessionRecord): Promise<Record<string, string>> {
		const stats = record.derived ?? derive(record);
		const excerpts: Record<string, string> = {};
		let total = 0;

		for (const path of stats.notesTouched.slice(0, MAX_NOTES)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			// Deleted since the session, or not a note: skip it.
			if (!(file instanceof TFile)) continue;

			const text = stripFrontmatter(await this.app.vault.cachedRead(file)).trim();
			const excerpt = text.slice(0, Math.min(MAX_CHARS_PER_NOTE, MAX_TOTAL_CHARS - total));
			if (excerpt === "") continue;

			excerpts[path] = excerpt;
			total += excerpt.length;
			if (total >= MAX_TOTAL_CHARS) break;
		}
		return excerpts;
	}
}

/** The user message: the path through the notes, stats, then note excerpts if any. */
export function buildUserPrompt(
	record: SessionRecord,
	excerpts: Record<string, string>,
	questions: string,
): string {
	const stats = record.derived ?? derive(record);
	const lines = [`Study session, ${formatDuration(record.durationSec ?? 0)}.`];

	if (stats.transitions.length > 0) {
		lines.push("", "Path through the notes (\"via link\" means they followed a link):");
		for (const { from, to, viaLink } of stats.transitions.slice(0, MAX_LISTED_NOTES)) {
			lines.push(`- ${noteTitle(from)} → ${noteTitle(to)}${viaLink ? " (via link)" : ""}`);
		}
	}

	lines.push("", "Notes, most time spent first:");
	for (const path of stats.notesTouched.slice(0, MAX_LISTED_NOTES)) {
		const minutes = Math.round((stats.timePerNoteSec[path] ?? 0) / 60);
		const created = stats.created.includes(path) ? ", created this session" : "";
		lines.push(`- ${noteTitle(path)} (${minutes} min${created})`);
	}
	if (stats.notesTouched.length > MAX_LISTED_NOTES) {
		lines.push(`- ...and ${stats.notesTouched.length - MAX_LISTED_NOTES} more`);
	}
	if (stats.tagsTouched.length > 0) lines.push("", `Tags: ${stats.tagsTouched.join(", ")}`);

	const paths = Object.keys(excerpts);
	if (paths.length > 0) {
		lines.push("", "Excerpts from the notes (may be cut off):");
		for (const path of paths) {
			lines.push("", `<note title="${noteTitle(path)}">`, excerpts[path] ?? "", "</note>");
		}
	} else {
		lines.push("", "Only titles are available, not note content.");
	}

	lines.push("", `Grill me with ${questions} questions.`);
	return lines.join("\n");
}

function describeStatus(status: number): string {
	switch (status) {
		case 401:
			return "API key was rejected";
		case 403:
			return "API key doesn't have access to this model";
		case 404:
			return "model not found, check the model setting";
		case 429:
			return "rate limited by the Claude API";
		case 529:
		case 503:
			return "Claude API is overloaded";
		default:
			return `Claude API error ${status}`;
	}
}

function stripFrontmatter(text: string): string {
	return text.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}
