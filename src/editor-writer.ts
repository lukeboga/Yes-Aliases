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

/**
 * A precomputed change to apply to a file. `from` and `to` are byte
 * offsets into the file content at the time the change was planned.
 * `original` is used as a safety check at apply time.
 */
export interface PlannedChange {
	from: number;
	to: number;
	original: string;
	newText: string;
}

/**
 * Apply a precomputed change list to an open editor. Changes are applied
 * in reverse offset order so earlier changes don't shift later offsets.
 * Each change is verified against the current editor content before
 * applying; mismatches are skipped silently.
 *
 * Returns the number of changes successfully applied.
 */
export function applyChangesInEditor(
	editor: Editor,
	changes: PlannedChange[],
): number {
	if (changes.length === 0) return 0;
	const content = editor.getValue();
	const sorted = [...changes].sort((a, b) => b.from - a.from);
	let applied = 0;
	for (const change of sorted) {
		const actual = content.slice(change.from, change.to);
		if (actual !== change.original) continue;
		const from = editor.offsetToPos(change.from);
		const to = editor.offsetToPos(change.to);
		editor.replaceRange(change.newText, from, to);
		applied++;
	}
	return applied;
}

/** Result of attempting to update the link under the cursor. */
export interface CursorUpdateResult {
	/** Whether a wikilink was found at the cursor position. */
	found: boolean;
	/** User-facing message describing the outcome. */
	message: string;
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

/**
 * Update the single wikilink under the cursor.
 * Returns `{ found: false }` if the cursor is not on a wikilink, allowing
 * callers to fall back to other strategies (e.g. target-matching).
 */
export function updateLinkUnderCursor(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
): CursorUpdateResult {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { found: false, message: "No wikilink under cursor" };

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
			if (!isLinkExcluded(link, content, excludedRanges, settings)) {
				const linkpath = getLinkpathForResolution(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					return { found: true, message: skipReasonMessage(decision.reason) };
				}

				const from = editor.offsetToPos(link.position.start.offset);
				const to = editor.offsetToPos(link.position.end.offset);
				editor.replaceRange(decision.newText, from, to);
				return { found: true, message: `Link updated: ${alias}` };
			}
		}
	}

	// Fall through to frontmatter links — find all occurrences to handle duplicates
	if (
		settings.updateFrontmatterLinks &&
		cache.frontmatterLinks &&
		cache.frontmatterLinks.length > 0
	) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			const searchFrom = new Map<string, number>();
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
				if (cursorOffset < offset.start || cursorOffset > offset.end) continue;

				const linkpath = getLinkpathFromFrontmatterLink(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					return { found: true, message: skipReasonMessage(decision.reason) };
				}

				const from = editor.offsetToPos(offset.start);
				const to = editor.offsetToPos(offset.end);
				editor.replaceRange(decision.newText, from, to);
				return { found: true, message: `Link updated: ${alias}` };
			}
		}
	}

	return { found: false, message: "No wikilink under cursor" };
}

/** Options for updateLinksInFile. */
export interface UpdateLinksInFileOptions {
	/** If provided, only links resolving to this file are updated. */
	targetFile?: TFile;
	/** If true, only frontmatter links are processed (body links untouched). */
	frontmatterOnly?: boolean;
}

/**
 * Update all qualifying wikilinks in the active file. Returns stats.
 * Use `options.targetFile` to scope to a single target, and
 * `options.frontmatterOnly` to skip body links entirely.
 */
export function updateLinksInFile(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
	options: UpdateLinksInFileOptions = {},
): WriteStats {
	const { targetFile, frontmatterOnly = false } = options;
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { updated: 0, skipped: 0 };

	const hasBodyLinks = !frontmatterOnly && cache.links && cache.links.length > 0;
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
			if (isLinkExcluded(link, content, excludedRanges, settings)) {
				continue;
			}

			const linkpath = getLinkpathForResolution(link);
			if (targetFile) {
				const resolved = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
				if (resolved?.path !== targetFile.path) continue;
			}
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

	// Frontmatter links — track search positions to handle duplicate originals
	if (hasFmLinks) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			const searchFrom = new Map<string, number>();
			for (const link of cache.frontmatterLinks!) {
				const linkpath = getLinkpathFromFrontmatterLink(link);
				if (targetFile) {
					const resolved = app.metadataCache.getFirstLinkpathDest(linkpath, file.path);
					if (resolved?.path !== targetFile.path) continue;
				}
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);
				const decision = decideRewrite(input);

				if (decision.action === "skip") {
					skipped++;
				} else {
					const startFrom = searchFrom.get(link.original) ?? yamlRange.start;
					const offset = findFrontmatterLinkOffset(
						content,
						link.original,
						startFrom,
						yamlRange.end,
					);
					if (offset) {
						rewrites.push({
							from: offset.start,
							to: offset.end,
							newText: decision.newText,
						});
						searchFrom.set(link.original, offset.end);
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
