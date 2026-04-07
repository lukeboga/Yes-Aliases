import { Notice, Plugin, TFile, TFolder, type MarkdownView } from "obsidian";
import { resolveAlias } from "./alias-resolver";
import { decideRewrite } from "./pipeline";
import {
	findFrontmatterLinkOffset,
	getLinkpathFromFrontmatterLink,
	getYamlSectionRange,
	toLinkInput,
} from "./link-filter";
import {
	type YesAliasesSettings,
	YesAliasesSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { updateLinkUnderCursor, updateLinksInFile } from "./editor-writer";
import {
	updateLinksInFolder,
	updateLinksInVault,
} from "./vault-writer";

export default class YesAliasesPlugin extends Plugin {
	settings!: YesAliasesSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new YesAliasesSettingTab(this.app, this));
		this.registerCommands();
		this.registerContextMenus();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{} as YesAliasesSettings,
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<YesAliasesSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private registerCommands(): void {
		this.addCommand({
			id: "update-link-under-cursor",
			name: "Update link under cursor",
			editorCallback: (editor, view) => {
				const file = view.file;
				if (!file) return;
				const message = updateLinkUnderCursor(
					this.app,
					editor,
					file,
					this.settings,
				);
				new Notice(message);
			},
		});

		this.addCommand({
			id: "update-links-in-file",
			name: "Update all links in current file",
			editorCallback: (editor, view) => {
				const file = view.file;
				if (!file) return;
				const stats = updateLinksInFile(
					this.app,
					editor,
					file,
					this.settings,
				);
				if (stats.updated === 0 && stats.skipped === 0) {
					new Notice("No links to update");
				} else {
					new Notice(
						`${stats.updated} links updated, ${stats.skipped} skipped`,
					);
				}
			},
		});

		this.addCommand({
			id: "update-links-in-vault",
			name: "Update all links in vault",
			callback: async () => {
				const stats = await updateLinksInVault(
					this.app,
					this.settings,
				);
				if (stats.updated === 0) {
					new Notice("No links to update in vault");
				} else {
					new Notice(
						`${stats.filesProcessed} files — ${stats.updated} links updated, ${stats.skipped} skipped`,
					);
				}
			},
		});

		this.addCommand({
			id: "update-links-in-folder",
			name: "Update all links in current folder",
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile?.parent) {
					new Notice("No active file");
					return;
				}
				const folder = activeFile.parent;
				const stats = await updateLinksInFolder(
					this.app,
					folder,
					this.settings,
				);
				if (stats.updated === 0) {
					new Notice(
						`No links to update in ${folder.name}`,
					);
				} else {
					new Notice(
						`${stats.filesProcessed} files — ${stats.updated} links updated, ${stats.skipped} skipped`,
					);
				}
			},
		});
	}

	private registerContextMenus(): void {
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				const file = (view as MarkdownView).file;
				if (!file) return;
				menu.addItem((item) => {
					item.setTitle("Update link alias")
						.setIcon("links-going-out")
						.onClick(() => {
							const message = updateLinkUnderCursor(
								this.app,
								editor,
								file,
								this.settings,
							);
							new Notice(message);
						});
				});
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, abstractFile, source, leaf) => {
				if (source !== "link-context-menu") return;
				if (!(abstractFile instanceof TFile)) return;
				if (!this.settings.updateFrontmatterLinks) return;

				const targetFile = abstractFile;
				const { alias } = resolveAlias(this.app, targetFile.path, "");
				if (!alias) return;

				const sourceFile = (leaf?.view as MarkdownView)?.file ?? this.app.workspace.getActiveFile();
				if (!sourceFile) return;

				menu.addItem((item) => {
					item.setTitle("Update link alias")
						.setIcon("links-going-out")
						.onClick(() => {
							const cache = this.app.metadataCache.getFileCache(sourceFile);
							if (!cache?.frontmatterLinks) return;

							const yamlRange = getYamlSectionRange(cache.sections);
							if (!yamlRange) return;

							const editor = (leaf?.view as MarkdownView)?.editor;
							if (!editor) return;

							const content = editor.getValue();
							const rewrites: Array<{ from: number; to: number; newText: string }> = [];

							for (const link of cache.frontmatterLinks) {
								const linkpath = getLinkpathFromFrontmatterLink(link);
								const resolved = this.app.metadataCache.getFirstLinkpathDest(
									linkpath,
									sourceFile.path,
								);
								if (resolved?.path !== targetFile.path) continue;

								const input = toLinkInput(link, alias, this.settings);
								const decision = decideRewrite(input);
								if (decision.action !== "rewrite") continue;

								const offset = findFrontmatterLinkOffset(
									content,
									link.original,
									yamlRange.start,
									yamlRange.end,
								);
								if (offset) {
									rewrites.push({
										from: offset.start,
										to: offset.end,
										newText: decision.newText,
									});
								}
							}

							rewrites.sort((a, b) => b.from - a.from);
							for (const rewrite of rewrites) {
								const from = editor.offsetToPos(rewrite.from);
								const to = editor.offsetToPos(rewrite.to);
								editor.replaceRange(rewrite.newText, from, to);
							}

							if (rewrites.length > 0) {
								new Notice(`${rewrites.length} link${rewrites.length > 1 ? "s" : ""} updated: ${alias}`);
							}
						});
				});
			}),
		);

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, abstractFile) => {
				if (!(abstractFile instanceof TFolder)) return;
				menu.addItem((item) => {
					item.setTitle("Update link aliases in folder")
						.setIcon("links-going-out")
						.onClick(async () => {
							const stats = await updateLinksInFolder(
								this.app,
								abstractFile,
								this.settings,
							);
							if (stats.updated === 0) {
								new Notice(
									`No links to update in ${abstractFile.name}`,
								);
							} else {
								new Notice(
									`${stats.filesProcessed} files — ${stats.updated} links updated, ${stats.skipped} skipped`,
								);
							}
						});
				});
			}),
		);
	}
}
