import type { SessionEvent, SessionRecord } from "../types";

/**
 * Holds the one study session that is currently running.
 * Pure: no Obsidian imports, and time is passed in so tests can control it.
 */
export class SessionStore {
	private current: SessionRecord | null = null;

	get active(): SessionRecord | null {
		return this.current;
	}

	start(now: Date): SessionRecord {
		if (this.current !== null) {
			throw new Error("A study session is already running");
		}
		const iso = now.toISOString();
		this.current = {
			id: `${iso.replace(/[:.]/g, '-')}-session`,
			start: iso,
			events: [],
			sources: [],
		};
		return this.current;
	}

	/** Resume an ongoing study session after reload. */
	resume(record: SessionRecord): void {
		if(this.current !== null) {
			throw new Error("A study session is already running");
		}
		this.current = record;
	}

	/** Records an event in the running session. Ignored when no session is running. */
	addEvent(event: SessionEvent): void {
		if (this.current === null) {
			return;
		}
		this.current.events.push(event);
		if (!this.current.sources.includes(event.source)) {
			this.current.sources.push(event.source);
		}
	}

	stop(now: Date): SessionRecord {
		const record = this.current;
		if (record === null) {
			throw new Error("No study session is running");
		}
		const startMs = new Date(record.start).getTime();
		record.end = now.toISOString();
		record.durationSec = Math.round((now.getTime() - startMs) / 1000);
		this.current = null;
		return record;
	}
}
