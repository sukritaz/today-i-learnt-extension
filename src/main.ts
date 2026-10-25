import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, TilSettings } from './settings';
import { SessionStore } from './core/sessions';

const STATUS_REFRESH_MS = 30 * 1000;

export default class TodayILearntPlugin extends Plugin {
	settings!: TilSettings;
	private store = new SessionStore();
	private statusBarEl!: HTMLElement;

	async onload() {
		await this.loadSettings();

		// Command palette entries. checkCallback hides each command when it
		// doesn't apply: "Start" only shows when idle, "Stop" only while studying.
		this.addCommand({
			id: 'start-study-session',
			name: 'Start study session',
			checkCallback: (checking) => {
				if (this.store.active) return false;
				if (!checking) this.startSession();
				return true;
			},
		});
		this.addCommand({
			id: 'stop-study-session',
			name: 'Stop study session',
			checkCallback: (checking) => {
				if (!this.store.active) return false;
				if (!checking) this.stopSession();
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

		// Refresh the elapsed time shown in the status bar.
		this.registerInterval(
			window.setInterval(() => this.updateStatusBar(), STATUS_REFRESH_MS),
		);
	}

	private startSession() {
		this.store.start(new Date());
		this.updateStatusBar();
		new Notice('Study session started');
	}

	private stopSession() {
		const record = this.store.stop(new Date());
		this.updateStatusBar();
		// Temporary until the daily-note writer exists (Phase 10).
		console.debug('Study session record', record);
		new Notice(`Study session stopped · ${formatDuration(record.durationSec ?? 0)}`);
	}

	private toggleSession() {
		if (this.store.active) this.stopSession();
		else this.startSession();
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
