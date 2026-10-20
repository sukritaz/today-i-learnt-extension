// Core contracts shared by sources, summarizers, sinks and storage.
// Keep this file free of `obsidian` imports: events and records hold only
// plain strings and numbers so any source can emit them and the MCP server
// can read them back from JSON.

/** Who reported an event. Informational only — consumers must not branch on it. */
export type SourceId = "obsidian" | "chrome" | "web-search";

/** Fields every event carries, regardless of source. */
interface BaseEvent {
	/** ISO 8601 timestamp. */
	ts: string;
	source: SourceId;
}

/**
 * Something that happened during a session. Event types describe *what*
 * happened (named after the thing it happened to), not *who* reported it.
 * New sources add new types; consumers ignore types they don't recognise.
 */
export type SessionEvent =
	| (BaseEvent & { type: "note.open"; path: string })
	| (BaseEvent & { type: "note.create"; path: string })
	| (BaseEvent & { type: "note.modify"; path: string; bytesDelta: number })
	| (BaseEvent & { type: "note.rename"; path: string; oldPath: string })
	| (BaseEvent & { type: "note.delete"; path: string })
	| (BaseEvent & { type: "link.follow"; from: string; to: string })
	| (BaseEvent & { type: "tag.touch"; path: string; tag: string });
// Future sources, e.g.:
// | (BaseEvent & { type: "page.visit"; url: string; title: string })
// | (BaseEvent & { type: "search.query"; query: string })

export type SessionEventType = SessionEvent["type"];

/** Stats computed from events once a session stops. */
export interface DerivedStats {
	notesTouched: string[];
	created: string[];
	timePerNoteSec: Record<string, number>;
	tagsTouched: string[];
	linksFollowed: number;
}

export type SummaryBackend = "claude-api" | "template";

export interface SessionSummary {
	backend: SummaryBackend;
	markdown: string;
	/** ISO 8601 timestamp. */
	generatedAt: string;
	/** Set when the preferred backend failed and the template was used instead. */
	fallbackReason?: string;
}

/** One study session. Persisted as JSON; the contract every layer agrees on. */
export interface SessionRecord {
	id: string;
	/** ISO 8601 timestamps. `end` is unset while the session is active. */
	start: string;
	end?: string;
	durationSec?: number;
	events: SessionEvent[];
	/** Sources that contributed events to this session. */
	sources: SourceId[];
	derived?: DerivedStats;
	summary?: SessionSummary;
}

/** Turns a finished session into markdown. Implementations: Claude API, template. */
export interface Summarizer {
	summarize(record: SessionRecord): Promise<string>;
}

/** Consumes a finished, summarized session. v1: daily-note writer. */
export interface Sink {
	write(record: SessionRecord): Promise<void>;
}
