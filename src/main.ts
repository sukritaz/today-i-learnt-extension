import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, TilSettings } from './settings';
import { SessionStore } from './core/sessions';
import { ObsidianSource } from './sources/obsidianSource';
import { derive } from './core/derive';
import { RecordStore } from './storage/recordStore';
import { summarize } from './summarizers';
import { formatDuration } from './core/format';
import { DailyNoteSink } from './sinks/dailyNotes';

const STATUS_REFRESH_MS = 30 * 1000;

export default class TodayILearntPlugin extends Plugin {
	settings!: TilSettings;
	private store = new SessionStore();
	private source!: ObsidianSource;
	private records!: RecordStore;
	private dailyNote!: DailyNoteSink;
	private statusBarEl!: HTMLElement;

	async onload() {
		await this.loadSettings();

		const pluginDir =
			this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		this.records = new RecordStore(this.app.vault.adapter, pluginDir);
		this.dailyNote = new DailyNoteSink(this.app);

		// Pick up a session that was running before a reload or crash.
		const saved = await this.records.loadActive();
		if (saved) {
			this.store.resume(saved);
		}

		// Vault activity flows into the store; the store ignores it while idle.
		this.source = new ObsidianSource(this, (event) => this.store.addEvent(event));
		this.source.register();

		// Command palette entries. checkCallback hides each command when it
		// doesn't apply: "Start" only shows when idle, "Stop" only while studying.
		this.addCommand({
			id: 'start-study-session',
			name: 'Start study session',
			checkCallback: (checking) => {
				if (this.store.active) return false;
				if (!checking) void this.startSession();
				return true;
			},
		});
		this.addCommand({
			id: 'stop-study-session',
			name: 'Stop study session',
			checkCallback: (checking) => {
				if (!this.store.active) return false;
				if (!checking) void this.stopSession();
				return true;
			},
		});

		// Left sidebar button that toggles a session.
		this.addRibbonIcon('graduation-cap', 'Start or stop study session', () => {
			this.toggleSession();
		});

		// Bottom-right status bar label; clicking it also toggles a session.
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass('mod-clickable');
		this.registerDomEvent(this.statusBarEl, 'click', () => this.toggleSession());
		this.updateStatusBar();

		// Refresh the elapsed time and save the running session every 30s.
		this.registerInterval(window.setInterval(() => void this.tick(), STATUS_REFRESH_MS));
	}

	onunload() {
		// Best effort: Obsidian doesn't wait for this, the 30s save is the safety net.
		const session = this.store.active;
		if (session) void this.records.saveActive(session);
	}

	private async startSession() {
		const record = this.store.start(new Date());
		this.source.startSession();
		this.updateStatusBar();
		new Notice('Study session started');
		await this.records.saveActive(record);
	}

	private async stopSession() {
		this.source.flush();
		const now = new Date();
		const record = this.store.stop(now);
		record.derived = derive(record);
		record.summary = await summarize(record, now);
		this.updateStatusBar();
		await this.records.save(record);
		await this.records.clearActive();

		// The record is already saved, so a failure here loses nothing.
		try {
			await this.dailyNote.write(record);
		} catch (error) {
			console.error('Could not write study block to daily note', error);
			new Notice('Study session saved, but writing to the daily note failed');
			return;
		}
		new Notice(`Study session stopped · ${formatDuration(record.durationSec ?? 0)}`);
	}

	private toggleSession() {
		if (this.store.active) void this.stopSession();
		else void this.startSession();
	}

	private async tick() {
		this.updateStatusBar();
		const session = this.store.active;
		if (session) await this.records.saveActive(session);
	}

	private updateStatusBar() {
		const session = this.store.active;
		if (!session) {
			this.statusBarEl.setText('📖 Start studying');
			return;
		}
		const elapsedSec = (Date.now() - new Date(session.start).getTime()) / 1000;
		this.statusBarEl.setText(`📖 Studying · ${formatDuration(elapsedSec)}`);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TilSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
