import { App, debounce, PluginSettingTab, Setting } from "obsidian";
import type YesAliasesPlugin from "./main";

/** Configuration options for the Yes Aliases plugin. */
export interface YesAliasesSettings {
	// Existing
	/** When true, replace existing display text with the alias. When false, skip links that already have display text. */
	overwriteExisting: boolean;
	/** When true, wikilinks inside frontmatter properties are included in alias updates. When false, only body links are updated. */
	updateFrontmatterLinks: boolean;
	/** Folder paths (relative to vault root) excluded from folder and vault-wide operations. Prefix-matched. */
	ignoredFolders: string[];

	// New in v0.1.0
	/** When true, heading and block anchors ([[Note#H]], [[Note#^id]]) are excluded from alias rewriting. */
	preserveHeadingAndBlockAnchors: boolean;
	/** When true, alias matching ignores letter case and rewrites normalize to canonical casing. */
	caseInsensitiveAliasMatch: boolean;
	/** When true, links to a newly-created note get auto-updated when the note gets its first alias. */
	autoPropagateNewNoteAliases: boolean;
	/** When true, any alias change to any note auto-propagates to backlinks vault-wide. */
	autoPropagateAllAliasChanges: boolean;
	/** Auto-propagation only shows a notice when affected file count exceeds this threshold (0 = always notify). */
	autoPropagateNoticeThreshold: number;
	/** Compress aliases to this many leading entries. The "to main" command always trims to 1 regardless. */
	aliasesKeepCount: number;
	/** When true, compress shows a confirmation modal instead of refusing when orphaned links exist. */
	compressWarnInsteadOfBlock: boolean;
	/** When true, remove strips display text from every link, including custom prose. ⚠ destructive. */
	removeIgnoresPropagationSafety: boolean;
}

export const DEFAULT_SETTINGS: YesAliasesSettings = {
	overwriteExisting: false,
	updateFrontmatterLinks: true,
	ignoredFolders: [],
	preserveHeadingAndBlockAnchors: false,
	caseInsensitiveAliasMatch: false,
	autoPropagateNewNoteAliases: true,
	autoPropagateAllAliasChanges: false,
	autoPropagateNoticeThreshold: 5,
	aliasesKeepCount: 1,
	compressWarnInsteadOfBlock: false,
	removeIgnoresPropagationSafety: false,
};

/** Settings tab for the Yes Aliases plugin. */
export class YesAliasesSettingTab extends PluginSettingTab {
	plugin: YesAliasesPlugin;

	constructor(app: App, plugin: YesAliasesPlugin) {
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
			.setName("Update frontmatter links")
			.setDesc(
				"When enabled, wikilinks inside frontmatter properties are included in alias updates. When disabled, only body links are updated.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.updateFrontmatterLinks)
					.onChange(async (value) => {
						this.plugin.settings.updateFrontmatterLinks = value;
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
					.onChange(
						debounce(async (value: string) => {
							this.plugin.settings.ignoredFolders = value
								.split("\n")
								.map((s) => s.trim())
								.filter((s) => s.length > 0);
							await this.plugin.saveSettings();
						}, 500, true),
					),
			);
	}
}
