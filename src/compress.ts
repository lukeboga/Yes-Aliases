import { type App, TFile } from "obsidian";
import { isAliasMatch } from "./pipeline";
import { getAllAliases } from "./alias-resolver";
import {
	buildExcludedRanges,
	getLinkpathForResolution,
	getLinkpathFromFrontmatterLink,
	isLinkExcluded,
} from "./link-filter";
import type { YesAliasesSettings } from "./settings";

export interface CompressOrphan {
	sourcePath: string;
	displayText: string;
	original: string;
}

export interface CompressOrphanResult {
	/** Alias entries that would be stripped (entries beyond keepCount). */
	strippedEntries: string[];
	/** Backlinks that currently use a stripped alias as their display text. */
	orphans: CompressOrphan[];
	/** Unique source paths from orphans. */
	affectedSourcePaths: Set<string>;
}

/** Narrow an AbstractFile (or unknown) to a markdown TFile. */
function isMarkdownFile(file: unknown): file is TFile {
	return file instanceof TFile && file.extension === "md";
}

/**
 * Scan backlinks of `target` for display text matching any alias entry
 * that would be removed by compressing to `keepCount`. Cache-first via
 * metadataCache.resolvedLinks — no file I/O.
 */
export function detectCompressOrphans(
	app: App,
	target: TFile,
	keepCount: number,
	settings: YesAliasesSettings,
): CompressOrphanResult {
	const aliases = getAllAliases(app, target);
	const empty: CompressOrphanResult = {
		strippedEntries: [],
		orphans: [],
		affectedSourcePaths: new Set(),
	};
	if (aliases.length <= keepCount) return empty;

	const strippedEntries = aliases.slice(keepCount);
	const orphans: CompressOrphan[] = [];
	const affectedSourcePaths = new Set<string>();

	// Inverse lookup: find source files linking to target.
	for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
		if (!targets[target.path]) continue;
		const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
		if (!isMarkdownFile(sourceFile)) continue;
		const cache = app.metadataCache.getFileCache(sourceFile);
		if (!cache) continue;

		// Body links
		if (cache.links) {
			const excludedRanges = buildExcludedRanges(cache.sections);
			for (const link of cache.links) {
				if (isLinkExcluded(link, "", excludedRanges, settings)) continue;
				const linkpath = getLinkpathForResolution(link);
				const resolved = app.metadataCache.getFirstLinkpathDest(
					linkpath,
					sourcePath,
				);
				if (resolved?.path !== target.path) continue;
				const displayText = extractDisplayText(link.original);
				if (displayText === null) continue;
				if (isAliasMatch(displayText, strippedEntries, settings.caseInsensitiveAliasMatch)) {
					orphans.push({ sourcePath, displayText, original: link.original });
					affectedSourcePaths.add(sourcePath);
				}
			}
		}

		// Frontmatter links
		if (settings.updateFrontmatterLinks && cache.frontmatterLinks) {
			for (const link of cache.frontmatterLinks) {
				const linkpath = getLinkpathFromFrontmatterLink(link);
				const resolved = app.metadataCache.getFirstLinkpathDest(
					linkpath,
					sourcePath,
				);
				if (resolved?.path !== target.path) continue;
				const displayText = extractDisplayText(link.original);
				if (displayText === null) continue;
				if (isAliasMatch(displayText, strippedEntries, settings.caseInsensitiveAliasMatch)) {
					orphans.push({ sourcePath, displayText, original: link.original });
					affectedSourcePaths.add(sourcePath);
				}
			}
		}
	}

	return { strippedEntries, orphans, affectedSourcePaths };
}

/** Extract display text from a raw wikilink (with or without `!` prefix). Returns null if no pipe. */
function extractDisplayText(original: string): string | null {
	const pipeIdx = original.indexOf("|");
	if (pipeIdx === -1) return null;
	return original.slice(pipeIdx + 1, -2);
}
