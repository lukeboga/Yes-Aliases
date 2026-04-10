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
	autoPushNewNoteAliases: boolean;
	/** When true, any alias change to any note auto-pushes to backlinks vault-wide. */
	autoPushAllAliasChanges: boolean;
	/** Auto-push only shows a notice when affected file count exceeds this threshold (0 = always notify). */
	autoPushNoticeThreshold: number;
	/** Compress aliases to this many leading entries. The "to main" command always trims to 1 regardless. */
	aliasesKeepCount: number;
	/** When true, compress shows a confirmation modal instead of refusing when orphaned links exist. */
	compressWarnInsteadOfBlock: boolean;
	/** When true, remove strips display text from every link, including custom prose. ⚠ destructive. */
	removeIgnoresPushSafety: boolean;
}

export const DEFAULT_SETTINGS: YesAliasesSettings = {
	overwriteExisting: false,
	updateFrontmatterLinks: true,
	ignoredFolders: [],
	preserveHeadingAndBlockAnchors: false,
	caseInsensitiveAliasMatch: false,
	autoPushNewNoteAliases: true,
	autoPushAllAliasChanges: false,
	autoPushNoticeThreshold: 5,
	aliasesKeepCount: 1,
	compressWarnInsteadOfBlock: false,
	removeIgnoresPushSafety: false,
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
				"When enabled, links that already have display text get their text replaced with the target note's alias. When disabled, links with display text are left alone.",
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
				"When enabled, wikilinks inside frontmatter properties are included in alias updates. When disabled, only links in the note body are updated.",
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
			.setName("Preserve heading and block anchors")
			.setDesc(
				"When enabled, links to a specific heading or block ([[Note#Heading]], [[Note^block-id]]) are left alone. Obsidian's built-in rendering (\"Note > Heading\") is used instead of the note's alias. Leave this off if your notes have ID-style filenames (e.g. 20240315-mtg) where the built-in rendering is hard to read. Turn it on if your filenames are already descriptive and you prefer the native heading display.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.preserveHeadingAndBlockAnchors)
					.onChange(async (value) => {
						this.plugin.settings.preserveHeadingAndBlockAnchors = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Match aliases regardless of letter case")
			.setDesc(
				"When enabled, a link showing \"foo bar\" matches an alias \"Foo Bar\" and gets rewritten to the alias's exact casing. This helps clean up casing drift across a large vault.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.caseInsensitiveAliasMatch)
					.onChange(async (value) => {
						this.plugin.settings.caseInsensitiveAliasMatch = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── Automatic updates ───
		new Setting(containerEl).setName("Automatic updates").setHeading();

		new Setting(containerEl)
			.setName("Auto-update links when a new note gets its first alias")
			.setDesc(
				"When you create a new note and give it an alias, links to that note in other notes are updated automatically to show the new alias. Example: you create a note 20240315-mtg, link to it from another note as [[20240315-mtg]], then add aliases: [Q1 review] to the new note — the link in the other note updates to show \"Q1 review\". This setting only affects notes created during the current Obsidian session.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoPushNewNoteAliases)
					.onChange(async (value) => {
						this.plugin.settings.autoPushNewNoteAliases = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Auto-update links whenever any note's alias changes")
			.setDesc(
				"When you change a note's alias, links to that note in other notes are updated automatically to show the new alias. ⚠ This can touch many files at once. Leave off until you've tried the manual \"Push aliases\" commands first and are confident about the blast radius in your vault.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoPushAllAliasChanges)
					.onChange(async (value) => {
						this.plugin.settings.autoPushAllAliasChanges = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Quiet mode: only notify on larger updates")
			.setDesc(
				"When automatic updates touch this many files or fewer, no notice is shown. Set to 0 to always show a notice. Default: 5.",
			)
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.autoPushNoticeThreshold))
					.onChange(
						debounce(async (value: string) => {
							const n = Number.parseInt(value, 10);
							if (Number.isNaN(n) || n < 0) return;
							this.plugin.settings.autoPushNoticeThreshold = n;
							await this.plugin.saveSettings();
						}, 500, true),
					),
			);

		// ─── Compress aliases ───
		new Setting(containerEl).setName("Compress aliases").setHeading();

		new Setting(containerEl)
			.setName("Main aliases to keep")
			.setDesc(
				"When you run \"Compress aliases in file\", this many leading entries of the aliases array are kept and the rest are removed. The \"Compress to main alias\" command always trims to 1 regardless of this setting. Default: 1.",
			)
			.addText((text) =>
				text
					.setPlaceholder("1")
					.setValue(String(this.plugin.settings.aliasesKeepCount))
					.onChange(
						debounce(async (value: string) => {
							const n = Number.parseInt(value, 10);
							if (Number.isNaN(n) || n < 1) return;
							this.plugin.settings.aliasesKeepCount = n;
							await this.plugin.saveSettings();
						}, 500, true),
					),
			);

		new Setting(containerEl)
			.setName("Warn instead of blocking when compress would orphan links")
			.setDesc(
				"Compressing a note's aliases list removes entries beyond the keep count. If any link elsewhere in the vault still shows one of those removed aliases, the plugin normally refuses to compress and asks you to run \"Push aliases in vault\" first. When this is enabled, the plugin shows a warning dialog instead and lets you compress anyway. ⚠ Compressing with orphaned links strands those links: the plugin no longer recognizes the old display text as an alias of the target, so future updates won't fix it. Leave off unless you know what you're doing.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.compressWarnInsteadOfBlock)
					.onChange(async (value) => {
						this.plugin.settings.compressWarnInsteadOfBlock = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── Remove link aliases ───
		new Setting(containerEl).setName("Remove link aliases").setHeading();

		new Setting(containerEl)
			.setName("Remove also strips custom display text")
			.setDesc(
				"The remove commands normally only strip display text that matches one of the target note's aliases. Custom display text (e.g., [[Note|click here to read more]]) is left alone. When this is enabled, remove strips display text from every link, including custom text. ⚠ Enabling this destroys intentional custom display text. The default is strongly recommended.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.removeIgnoresPushSafety)
					.onChange(async (value) => {
						this.plugin.settings.removeIgnoresPushSafety = value;
						await this.plugin.saveSettings();
					}),
			);

		// ─── Ignored folders ───
		new Setting(containerEl).setName("Ignored folders").setHeading();

		new Setting(containerEl)
			.setName("Ignored folders")
			.setDesc(
				"Folder paths excluded from folder and vault-wide operations. One per line. Prefix-matched (so \"_meta\" also excludes \"_meta/templates\").",
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
