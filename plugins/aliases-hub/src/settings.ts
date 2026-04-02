import { App, PluginSettingTab, Setting } from "obsidian";
import type AliasHubPlugin from "./main";

/** Configuration options for the Alias Hub plugin. */
export interface AliasHubSettings {
	/** When true, replace existing display text with the alias. When false, skip links that already have display text. */
	overwriteExisting: boolean;
	/** Folder paths (relative to vault root) excluded from folder and vault-wide operations. Prefix-matched. */
	ignoredFolders: string[];
}

export const DEFAULT_SETTINGS: AliasHubSettings = {
	overwriteExisting: false,
	ignoredFolders: [],
};

/** Settings tab for the Alias Hub plugin. */
export class AliasHubSettingTab extends PluginSettingTab {
	plugin: AliasHubPlugin;

	constructor(app: App, plugin: AliasHubPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Overwrite existing display text")
			.setDesc(
				"When enabled, existing display text on wikilinks will be replaced with the alias. When disabled, links with display text are skipped.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.overwriteExisting)
					.onChange(async (value) => {
						this.plugin.settings.overwriteExisting = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Ignored folders")
			.setDesc(
				"Folder paths excluded from folder and vault-wide operations. One per line. Prefix-matched (e.g. '_meta' also ignores '_meta/templates').",
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("_meta\ntemplates")
					.setValue(this.plugin.settings.ignoredFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.ignoredFolders = value
							.split("\n")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					}),
			);
	}
}
