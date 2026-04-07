import type { App, Editor, TFile } from "obsidian";
import { decideRewrite } from "./pipeline";
import { resolveAlias } from "./alias-resolver";
import {
	buildExcludedRanges,
	getLinkpathForResolution,
	isLinkExcluded,
	toLinkInput,
} from "./link-filter";
import type { AliasHubSettings } from "./settings";

/** Stats returned after a write operation. */
export interface WriteStats {
	updated: number;
	skipped: number;
}

/** Update the single wikilink under the cursor. Returns a user-facing message. */
export function updateLinkUnderCursor(
	app: App,
	editor: Editor,
	file: TFile,
	settings: AliasHubSettings,
): string {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.links || cache.links.length === 0) {
		return "No wikilink under cursor";
	}

	const cursor = editor.getCursor();
	const cursorOffset = editor.posToOffset(cursor);

	const link = cache.links.find(
		(l) =>
			cursorOffset >= l.position.start.offset &&
			cursorOffset <= l.position.end.offset,
	);

	if (!link) {
		return "No wikilink under cursor";
	}

	const content = editor.getValue();
	const excludedRanges = buildExcludedRanges(cache.sections);

	if (isLinkExcluded(link, content, excludedRanges)) {
		return "No wikilink under cursor";
	}

	const linkpath = getLinkpathForResolution(link);
	const { alias } = resolveAlias(app, linkpath, file.path);
	const input = toLinkInput(link, alias, settings);
	const decision = decideRewrite(input);

	if (decision.action === "skip") {
		if (decision.reason === "no-alias") return "No alias found for target";
		return "Link already up to date";
	}

	const from = editor.offsetToPos(link.position.start.offset);
	const to = editor.offsetToPos(link.position.end.offset);
	editor.replaceRange(decision.newText, from, to);

	return `Link updated: ${alias}`;
}

/** Update all qualifying wikilinks in the active file. Returns stats. */
export function updateLinksInFile(
	app: App,
	editor: Editor,
	file: TFile,
	settings: AliasHubSettings,
): WriteStats {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.links || cache.links.length === 0) {
		return { updated: 0, skipped: 0 };
	}

	const content = editor.getValue();
	const excludedRanges = buildExcludedRanges(cache.sections);

	const rewrites: Array<{
		from: number;
		to: number;
		newText: string;
	}> = [];
	let skipped = 0;

	for (const link of cache.links) {
		if (isLinkExcluded(link, content, excludedRanges)) {
			continue;
		}

		const linkpath = getLinkpathForResolution(link);
		const { alias } = resolveAlias(app, linkpath, file.path);
		const input = toLinkInput(link, alias, settings);
		const decision = decideRewrite(input);

		if (decision.action === "skip") {
			skipped++;
		} else {
			rewrites.push({
				from: link.position.start.offset,
				to: link.position.end.offset,
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

	return { updated: rewrites.length, skipped };
}
