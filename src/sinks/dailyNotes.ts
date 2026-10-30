import { App, moment } from "obsidian";
import { createDailyNote, getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";
import type { SessionRecord, Sink } from "../types";
import { renderBlock, upsertBlock } from "../core/block";

/**
 * Writes the session block into the daily note of the day the session started.
 * Uses the folder, date format and template from the Daily notes (or Periodic Notes) settings.
 */
export class DailyNoteSink implements Sink {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async write(record: SessionRecord): Promise<void> {
		// A session that crosses midnight belongs to the day it started.
		const date = moment(record.start);
		const file = getDailyNote(date, getAllDailyNotes()) ?? (await createDailyNote(date));

		const block = renderBlock(record);
		// process() reads and writes in one step, so it can't clobber an edit made in between.
		await this.app.vault.process(file, (text) => upsertBlock(text, record.id, block));
	}
}
