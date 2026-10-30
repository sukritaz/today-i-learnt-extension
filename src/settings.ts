import { App, PluginSettingTab, Setting } from 'obsidian';
import type TodayILearntPlugin from './main';

export type Verbosity = 'short' | 'medium' | 'long';
export type DailyNoteMode = 'auto' | 'path';

export interface TilSettings {
	/** Claude API key. Empty means template summaries only. */
	apiKey: string;
	model: string;
	verbosity: Verbosity;
	/** Send note excerpts to Claude, or only titles, tags and times. */
	sendNoteContent: boolean;
	/** Show the "Topics" and "Notes" lines in the block, above the summary. */
	includeStructured: boolean;
	/** "auto" uses the Daily notes / Periodic Notes settings; "path" always uses fallbackPath. */
	dailyNoteMode: DailyNoteMode;
	/** Used in "path" mode, or when no daily notes plugin is on. {{date}} or {{date:FORMAT}}. */
	fallbackPath: string;
}

export const DEFAULT_SETTINGS: TilSettings = {
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
	'claude-sonnet-5-5': 'Sonnet (better prose)',
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
		const settings = this.plugin.settings;

		new Setting(containerEl).setName('Summaries').setHeading();

		new Setting(containerEl)
			.setName('Claude API key')
			.setDesc('Leave empty to use the offline template summary.')
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
			text: 'When a key is set, session note content is sent to Anthropic to generate summaries.',
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
			.setName('Summary length')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ short: 'Short', medium: 'Medium', long: 'Long' })
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

		new Setting(containerEl).setName('Daily note').setHeading();

		new Setting(containerEl)
			.setName('Show stats in block')
			.setDesc('Add the topics and note counts above the summary.')
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
}
