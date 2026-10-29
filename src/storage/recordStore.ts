import { DataAdapter, normalizePath } from "obsidian";
import type { SessionRecord } from "../types";

/** Running session, saved periodically so a reload or crash doesn't lose it. */
const ACTIVE_FILE = 'active';

/**
 * Saves session records as JSON files in the plugin's own data folder.
 * <plugin dir>/sessions/<id>.json
 */
export class RecordStore {
	private adapter: DataAdapter;
	private dir: string;

	constructor(adapter: DataAdapter, pluginDir: string) {
		this.adapter = adapter;
		this.dir = normalizePath(`${pluginDir}/sessions`);
	}

	async save(record: SessionRecord): Promise<void> {
		await this.writeJson(record.id, record);
	}

	async load(id: string): Promise<SessionRecord | null> {
		return this.readJson(id);
	}

	private async writeJson(filename: string, data: SessionRecord): Promise<void> {
		if (!(await this.adapter.exists(this.dir))) {
			await this.adapter.mkdir(this.dir);
		}
		await this.adapter.write(this.pathFor(filename), JSON.stringify(data, null, 2));
	}

	private async readJson(filename: string): Promise<SessionRecord | null> {
		const path = this.pathFor(filename);
		if (!(await this.adapter.exists(path))) {
			return null;
		}
		try {
			return JSON.parse(await this.adapter.read(path)) as SessionRecord;
		} catch {
			// A half-written or hand-edited file: treat as missing rather than crash.
			return null;
		}
	}

	private pathFor(filename: string): string {
		return normalizePath(`${this.dir}/${filename}.json`);
	}

	async saveActive(record: SessionRecord): Promise<void> {
		await this.writeJson(ACTIVE_FILE, record);
	}

	async loadActive(): Promise<SessionRecord | null> {
		return await this.readJson(ACTIVE_FILE);
	}

	async clearActive(): Promise<void> {
		const path = this.pathFor(ACTIVE_FILE);
		if (await this.adapter.exists(path)) {
			await this.adapter.remove(path);
		}
	}

	/** Ids of all saved sessions, newest first. */
	async list(): Promise<string[]> {
		if (!(await this.adapter.exists(this.dir))) return [];
		const { files } = await this.adapter.list(this.dir);
		return files
			.map((path) => path.substring(path.lastIndexOf('/') + 1))
			.filter((name) => name.endsWith('.json'))
			.map((name) => name.slice(0, -'.json'.length))
			.filter((id) => id !== ACTIVE_FILE)
			.sort()
			.reverse();
	}
}
