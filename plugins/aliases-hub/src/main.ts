import { Plugin } from "obsidian";
import {
	type AliasHubSettings,
	AliasHubSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";

export default class AliasHubPlugin extends Plugin {
	settings!: AliasHubSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new AliasHubSettingTab(this.app, this));
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
}
