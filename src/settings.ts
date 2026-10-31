import { App, PluginSettingTab, Setting } from 'obsidian';
import type TodayILearntPlugin from './main';

export type Verbosity = 'short' | 'medium' | 'long';
export type DailyNoteMode = 'auto' | 'path';

export interface TilSettings {
	/** Add grill-me questions under the path. Off: the block shows only the path. */
	grillMe: boolean;
	/** Claude API key, used only by Grill me. */
	apiKey: string;
	model: string;
	/** How many questions: short 3, medium 5, long 8. */
	verbosity: Verbosity;
	/** Send note excerpts to Claude, or only titles, tags and times. */
	sendNoteContent: boolean;
	/** Show the note counts line in the block. */
	includeStructured: boolean;
	/** "auto" uses the Daily notes / Periodic Notes settings; "path" always uses fallbackPath. */
	dailyNoteMode: DailyNoteMode;
	/** Used in "path" mode, or when no daily notes plugin is on. {{date}} or {{date:FORMAT}}. */
	fallbackPath: string;
}

export const DEFAULT_SETTINGS: TilSettings = {
	grillMe: false,
	apiKey: '',
	model: 'claude-haiku-5-5',
	verbosity: 'medium',
	sendNoteContent: true,
	includeStructured: true,
	dailyNoteMode: 'auto',
	fallbackPath: 'Daily/{{date}}.md',
};

const MODELS: Record<string, string> = {
	'claude-haiku-5-5': 'Haiku (fast, cheapest)',
	'claude-sonnet-5-5': 'Sonnet (sharper questions)',
};

export class TilSettingTab extends PluginSettingTab {
	private plugin: TodayILearntPlugin;

	constructor(app: App, plugin: TodayILearntPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** Obsidian calls this every time the tab is opened, so build from scratch. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.displayDailyNoteSettings(containerEl);
		this.displayGrillMeSettings(containerEl);
	}

	private displayDailyNoteSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName('Daily note').setHeading();

		new Setting(containerEl)
			.setName('Show note counts')
			.setDesc('Add how many notes were touched and created under the header.')
			.addToggle((toggle) =>
				toggle.setValue(settings.includeStructured).onChange(async (value) => {
					settings.includeStructured = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Find daily note')
			.setDesc('Automatic follows your daily notes plugin settings.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ auto: 'Automatic', path: 'Use path below' })
					.setValue(settings.dailyNoteMode)
					.onChange(async (value) => {
						settings.dailyNoteMode = value as DailyNoteMode;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Daily note path')
			.setDesc('Used when set above, or when no daily notes plugin is on. {{date}} becomes 2026-10-31; {{date:DD-MM-YYYY}} picks a format.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.fallbackPath)
					.setValue(settings.fallbackPath)
					.onChange(async (value) => {
						settings.fallbackPath = value.trim() || DEFAULT_SETTINGS.fallbackPath;
						await this.plugin.saveSettings();
					}),
			);
	}

	private displayGrillMeSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settings;
		new Setting(containerEl).setName('Grill me').setHeading();

		new Setting(containerEl)
			.setName('Grill me')
			.setDesc('Add questions on what you studied, written by Claude with the grill-me-study skill. Needs a Claude API key. Off: the block shows only your path through the notes.')
			.addToggle((toggle) =>
				toggle.setValue(settings.grillMe).onChange(async (value) => {
					settings.grillMe = value;
					await this.plugin.saveSettings();
					// Redraw to show or hide the Claude options below.
					this.display();
				}),
			);

		if (!settings.grillMe) return;

		new Setting(containerEl)
			.setName('Claude API key')
			.setDesc('Create one in the Anthropic console. Without a key, simple offline questions are used.')
			.addText((text) => {
				text.inputEl.type = 'password';
				text
					.setPlaceholder('Paste your key')
					.setValue(settings.apiKey)
					.onChange(async (value) => {
						settings.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		const warning = containerEl.createDiv({ cls: 'til-setting-warning' });
		warning.createEl('p', {
			text: 'Your API key is stored in plain text in this plugin\'s data.json and will sync with your vault.',
		});
		warning.createEl('p', {
			text: 'When a key is set, session note content is sent to Anthropic to generate questions.',
		});

		new Setting(containerEl)
			.setName('Model')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(MODELS)
					.setValue(settings.model)
					.onChange(async (value) => {
						settings.model = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Number of questions')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ short: '3', medium: '5', long: '8' })
					.setValue(settings.verbosity)
					.onChange(async (value) => {
						settings.verbosity = value as Verbosity;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Send note content')
			.setDesc('Off: only note titles, tags and times are sent, never what you wrote.')
			.addToggle((toggle) =>
				toggle.setValue(settings.sendNoteContent).onChange(async (value) => {
					settings.sendNoteContent = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
