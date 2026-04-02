import { Plugin } from "obsidian";

export default class AliasHubPlugin extends Plugin {
	async onload(): Promise<void> {
		console.debug("Alias Hub loaded");
	}

	onunload(): void {
		console.debug("Alias Hub unloaded");
	}
}
