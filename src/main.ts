import { MarkdownView, Notice, Plugin, TFile, TFolder } from "obsidian";
import { resolveAlias } from "./alias-resolver";
import {
	findFrontmatterLinkOffset,
	getLinkpathForResolution,
	getLinkpathFromFrontmatterLink,
	getYamlSectionRange,
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
	/**
	 * Coordinates of the most recent contextmenu event. Used by the
	 * editor-menu handler to find the actual clicked position via
	 * CodeMirror's posAtCoords (editor.getCursor() is stale during
	 * the contextmenu event).
	 */
	private lastContextmenuCoords: { x: number; y: number } | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new YesAliasesSettingTab(this.app, this));
		this.registerDomEvent(
			document,
			"contextmenu",
			(evt: MouseEvent) => {
				this.lastContextmenuCoords = { x: evt.clientX, y: evt.clientY };
			},
			{ capture: true },
		);
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
				const result = updateLinkUnderCursor(
					this.app,
					editor,
					file,
					this.settings,
				);
				new Notice(result.message);
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
		// Editor-menu handler scoped to source-mode YAML wikilinks. Obsidian
		// does not fire `file-menu` with `link-context-menu` source for raw
		// wikilinks inside YAML in source mode, so we need this handler to
		// surface the menu item there. Body links are NOT handled here —
		// `file-menu` covers those in any mode, avoiding duplicates.
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				const file = (view as MarkdownView).file;
				if (!file) return;
				if (!this.settings.updateFrontmatterLinks) return;

				const coords = this.lastContextmenuCoords;
				if (!coords) return;

				// Use CodeMirror's posAtCoords to get the actual clicked
				// document offset, avoiding the cursor staleness issue.
				// `editor.cm` is the underlying CodeMirror 6 EditorView,
				// not exposed in obsidian.d.ts but stable in practice.
				const cm = (editor as unknown as {
					cm?: { posAtCoords: (c: { x: number; y: number }) => number | null };
				}).cm;
				if (!cm || typeof cm.posAtCoords !== "function") return;
				const clickOffset = cm.posAtCoords(coords);
				if (clickOffset == null) return;

				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatterLinks || cache.frontmatterLinks.length === 0) return;

				const yamlRange = getYamlSectionRange(cache.sections);
				if (!yamlRange) return;
				if (clickOffset < yamlRange.start || clickOffset > yamlRange.end) return;

				// Confirm the click landed on an actual wikilink in YAML.
				const content = editor.getValue();
				const searchFrom = new Map<string, number>();
				let onLink = false;
				for (const link of cache.frontmatterLinks) {
					const startFrom = searchFrom.get(link.original) ?? yamlRange.start;
					const offset = findFrontmatterLinkOffset(
						content,
						link.original,
						startFrom,
						yamlRange.end,
					);
					if (!offset) continue;
					searchFrom.set(link.original, offset.end);
					if (clickOffset >= offset.start && clickOffset <= offset.end) {
						onLink = true;
						break;
					}
				}

				if (!onLink) return;

				menu.addItem((item) => {
					item.setTitle("Update link alias")
						.setIcon("links-going-out")
						.onClick(() => {
							// By click time the cursor has moved to the
							// right-clicked position, so updateLinkUnderCursor
							// finds the correct link.
							const result = updateLinkUnderCursor(
								this.app,
								editor,
								file,
								this.settings,
							);
							new Notice(result.message);
						});
				});
			}),
		);

		// Handler for wikilink right-clicks via Obsidian's link-context-menu
		// event. Covers body links in any mode and Properties UI links in
		// Live Preview.
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, abstractFile, source) => {
				if (source !== "link-context-menu") return;
				if (!(abstractFile instanceof TFile)) return;

				const targetFile = abstractFile;
				const { alias } = resolveAlias(this.app, targetFile.path, "");
				if (!alias) return;

				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				const sourceFile = view?.file;
				if (!view || !sourceFile) return;

				const cache = this.app.metadataCache.getFileCache(sourceFile);
				if (!cache) return;

				// Confirm the source file actually contains a link to the target
				// (body or frontmatter, depending on settings) before adding the item.
				const hasBodyMatch =
					cache.links?.some((link) => {
						const linkpath = getLinkpathForResolution(link);
						const resolved = this.app.metadataCache.getFirstLinkpathDest(
							linkpath,
							sourceFile.path,
						);
						return resolved?.path === targetFile.path;
					}) ?? false;

				const hasFmMatch =
					(this.settings.updateFrontmatterLinks &&
						cache.frontmatterLinks?.some((link) => {
							const linkpath = getLinkpathFromFrontmatterLink(link);
							const resolved = this.app.metadataCache.getFirstLinkpathDest(
								linkpath,
								sourceFile.path,
							);
							return resolved?.path === targetFile.path;
						})) ?? false;

				if (!hasBodyMatch && !hasFmMatch) return;

				menu.addItem((item) => {
					item.setTitle("Update link alias")
						.setIcon("links-going-out")
						.onClick(() => {
							const editor = view.editor;
							if (!editor) return;

							// Try per-link update via cursor first. By the time the
							// menu item is clicked, the cursor has moved to the
							// right-clicked link (in source/Live Preview body and
							// source-mode YAML cases). This preserves the same
							// per-link semantics as the "Update link under cursor"
							// command.
							const result = updateLinkUnderCursor(
								this.app,
								editor,
								sourceFile,
								this.settings,
							);

							if (result.found) {
								new Notice(result.message);
								return;
							}

							// Fall back to target-matching for the Properties UI
							// case (Live Preview), where the click happens outside
							// CodeMirror so the cursor isn't on the link. Restrict
							// to frontmatter only — body links should never be
							// touched by a Properties UI right-click.
							const stats = updateLinksInFile(
								this.app,
								editor,
								sourceFile,
								this.settings,
								{ targetFile, frontmatterOnly: true },
							);

							if (stats.updated === 0) {
								new Notice("No links to update");
							} else {
								new Notice(
									`${stats.updated} link${stats.updated > 1 ? "s" : ""} updated: ${alias}`,
								);
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
