import { Notice, Plugin, TFolder, type MarkdownView } from "obsidian";
import {
	type AliasHubSettings,
	AliasHubSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { updateLinkUnderCursor, updateLinksInFile } from "./editor-writer";
import {
	updateLinksInFolder,
	updateLinksInVault,
} from "./vault-writer";

export default class AliasHubPlugin extends Plugin {
	settings!: AliasHubSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new AliasHubSettingTab(this.app, this));
		this.registerCommands();
		this.registerContextMenus();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{} as AliasHubSettings,
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<AliasHubSettings>,
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
