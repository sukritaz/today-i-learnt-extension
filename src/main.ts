import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, TilSettings } from './settings';
import { SessionStore } from './core/sessions';
import { ObsidianSource } from './sources/obsidianSource';
import { derive } from './core/derive';
import { RecordStore } from './storage/recordStore';

const STATUS_REFRESH_MS = 30 * 1000;

export default class TodayILearntPlugin extends Plugin {
	settings!: TilSettings;
	private store = new SessionStore();
	private source!: ObsidianSource;
	private records!: RecordStore;
	private statusBarEl!: HTMLElement;

	async onload() {
		await this.loadSettings();

		const pluginDir =
			this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		this.records = new RecordStore(this.app.vault.adapter, pluginDir);

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
		const record = this.store.stop(new Date());
		record.derived = derive(record);
		this.updateStatusBar();
		await this.records.save(record);
		await this.records.clearActive();
		// Temporary until the daily-note writer exists (Phase 10).
		console.debug('Study session record', record);
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

/** 2880 → "48m", 4320 → "1h 12m". */
function formatDuration(totalSec: number): string {
	const minutes = Math.floor(totalSec / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
