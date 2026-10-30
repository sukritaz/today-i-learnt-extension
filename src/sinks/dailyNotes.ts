import { App, moment, normalizePath, TFile } from "obsidian";
import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
} from "obsidian-daily-notes-interface";
import type { SessionRecord, Sink } from "../types";
import type { TilSettings } from "../settings";
import { renderBlock, upsertBlock } from "../core/block";

/**
 * Writes the session block into the daily note of the day the session started.
 * In "auto" mode it uses the folder, date format and template from the Daily notes
 * (or Periodic Notes) settings; otherwise the path pattern from our settings.
 */
export class DailyNoteSink implements Sink {
	private app: App;
	private getSettings: () => TilSettings;

	/** A getter rather than a copy, so changes in the settings tab apply right away. */
	constructor(app: App, getSettings: () => TilSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	async write(record: SessionRecord): Promise<void> {
		const settings = this.getSettings();
		const file = await this.findOrCreateNote(record, settings);

		const block = renderBlock(record, { includeStructured: settings.includeStructured });
		// process() reads and writes in one step, so it can't clobber an edit made in between.
		await this.app.vault.process(file, (text) => upsertBlock(text, record.id, block));
	}

	private async findOrCreateNote(record: SessionRecord, settings: TilSettings): Promise<TFile> {
		// A session that crosses midnight belongs to the day it started.
		const date = moment(record.start);

		if (settings.dailyNoteMode === "auto" && appHasDailyNotesPluginLoaded()) {
			return getDailyNote(date, getAllDailyNotes()) ?? (await createDailyNote(date));
		}

		const path = normalizePath(expandDatePattern(settings.fallbackPath, date));
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;

		const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
		if (folder && !(await this.app.vault.adapter.exists(folder))) {
			await this.app.vault.adapter.mkdir(folder);
		}
		return this.app.vault.create(path, "");
	}
}

/** "Daily/{{date}}.md" → "Daily/2026-10-31.md"; "{{date:DD-MM-YYYY}}" picks the format. */
function expandDatePattern(pattern: string, date: moment.Moment): string {
	const withExtension = pattern.endsWith(".md") ? pattern : `${pattern}.md`;
	return withExtension.replace(/\{\{date(?::([^}]+))?\}\}/g, (_match, format?: string) =>
		date.format(format ?? "YYYY-MM-DD"),
	);
}
