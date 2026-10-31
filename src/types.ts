// Core contracts shared by capture, summarizers, sinks and storage.
// Keep this file free of `obsidian` imports: events and records hold only
// plain strings and numbers so they can be saved and read back as JSON.

/** ISO 8601 timestamp, carried by every event. */
interface BaseEvent {
	ts: string;
}

/** Something that happened in the vault during a session. Consumers ignore types they don't recognise. */
export type SessionEvent =
	| (BaseEvent & { type: "note.open"; path: string })
	| (BaseEvent & { type: "note.create"; path: string })
	| (BaseEvent & { type: "note.modify"; path: string; bytesDelta: number })
	| (BaseEvent & { type: "note.rename"; path: string; oldPath: string })
	| (BaseEvent & { type: "note.delete"; path: string })
	| (BaseEvent & { type: "link.follow"; from: string; to: string })
	| (BaseEvent & { type: "tag.touch"; path: string; tag: string });

export type SessionEventType = SessionEvent["type"];

/** Moving from one note to a note not seen before in the session. */
export interface NoteTransition {
	from: string;
	to: string;
	/** True if the user got there by following a link, false for search, file explorer, etc. */
	viaLink: boolean;
}

/** Stats computed from events once a session stops. */
export interface DerivedStats {
	notesTouched: string[];
	created: string[];
	timePerNoteSec: Record<string, number>;
	tagsTouched: string[];
	linksFollowed: number;
	/** Opened notes in the order they were first visited. */
	visitOrder: string[];
	/** How each note after the first was reached. Together these form a tree. */
	transitions: NoteTransition[];
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
	derived?: DerivedStats;
	summary?: SessionSummary;
}

/** Turns a finished session into markdown. Implementations: Claude API, template. */
export interface Summarizer {
	summarize(record: SessionRecord): Promise<string>;
}

/** Consumes a finished session. Today: the daily-note writer; later, publish targets. */
export interface Sink {
	write(record: SessionRecord): Promise<void>;
}
