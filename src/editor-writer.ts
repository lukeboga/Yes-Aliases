import type { App, Editor, TFile } from "obsidian";
import { decideRewrite, type SkipReason } from "./pipeline";
import { resolveAlias } from "./alias-resolver";
import {
	buildExcludedRanges,
	findFrontmatterLinkOffset,
	getLinkpathForResolution,
	getLinkpathFromFrontmatterLink,
	getYamlSectionRange,
	isLinkExcluded,
	toLinkInput,
} from "./link-filter";
import type { YesAliasesSettings } from "./settings";

/** Stats returned after a write operation. */
export interface WriteStats {
	updated: number;
	skipped: number;
}

/** Map a pipeline skip reason to a user-facing notice message. */
export function skipReasonMessage(reason: SkipReason): string {
	switch (reason) {
		case "no-alias":
			return "No alias found for target";
		case "has-display-text":
			return "Skipped — display text already set";
		case "already-correct":
			return "Link already up to date";
	}
}

/** Update the single wikilink under the cursor. Returns a user-facing message. */
export function updateLinkUnderCursor(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
): string {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return "No wikilink under cursor";

	const cursor = editor.getCursor();
	const cursorOffset = editor.posToOffset(cursor);
	const content = editor.getValue();

	// Try body links first
	if (cache.links) {
		const link = cache.links.find(
			(l) =>
				cursorOffset >= l.position.start.offset &&
				cursorOffset <= l.position.end.offset,
		);

		if (link) {
			const excludedRanges = buildExcludedRanges(cache.sections);
			if (!isLinkExcluded(link, content, excludedRanges)) {
				const linkpath = getLinkpathForResolution(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					return skipReasonMessage(decision.reason);
				}

				const from = editor.offsetToPos(link.position.start.offset);
				const to = editor.offsetToPos(link.position.end.offset);
				editor.replaceRange(decision.newText, from, to);
				return `Link updated: ${alias}`;
			}
		}
	}

	// Fall through to frontmatter links
	if (
		settings.updateFrontmatterLinks &&
		cache.frontmatterLinks &&
		cache.frontmatterLinks.length > 0
	) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			for (const link of cache.frontmatterLinks) {
				const offset = findFrontmatterLinkOffset(
					content,
					link.original,
					yamlRange.start,
					yamlRange.end,
				);
				if (!offset) continue;
				if (cursorOffset < offset.start || cursorOffset > offset.end) continue;

				const linkpath = getLinkpathFromFrontmatterLink(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					return skipReasonMessage(decision.reason);
				}

				const from = editor.offsetToPos(offset.start);
				const to = editor.offsetToPos(offset.end);
				editor.replaceRange(decision.newText, from, to);
				return `Link updated: ${alias}`;
			}
		}
	}

	return "No wikilink under cursor";
}

/** Update all qualifying wikilinks in the active file. Returns stats. */
export function updateLinksInFile(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
): WriteStats {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { updated: 0, skipped: 0 };

	const hasBodyLinks = cache.links && cache.links.length > 0;
	const hasFmLinks =
		settings.updateFrontmatterLinks &&
		cache.frontmatterLinks &&
		cache.frontmatterLinks.length > 0;

	if (!hasBodyLinks && !hasFmLinks) {
		return { updated: 0, skipped: 0 };
	}

	const content = editor.getValue();
	const rewrites: Array<{
		from: number;
		to: number;
		newText: string;
	}> = [];
	let skipped = 0;

	// Body links
	if (hasBodyLinks) {
		const excludedRanges = buildExcludedRanges(cache.sections);
		for (const link of cache.links!) {
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
	}

	// Frontmatter links
	if (hasFmLinks) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			for (const link of cache.frontmatterLinks!) {
				const linkpath = getLinkpathFromFrontmatterLink(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					skipped++;
				} else {
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
			}
		}
	}

	// Apply all rewrites in reverse offset order
	rewrites.sort((a, b) => b.from - a.from);

	for (const rewrite of rewrites) {
		const from = editor.offsetToPos(rewrite.from);
		const to = editor.offsetToPos(rewrite.to);
		editor.replaceRange(rewrite.newText, from, to);
	}

	return { updated: rewrites.length, skipped };
}
