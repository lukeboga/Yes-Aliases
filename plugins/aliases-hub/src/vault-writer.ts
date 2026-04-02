import {
	type App,
	type TAbstractFile,
	TFile,
	TFolder,
	Vault,
} from "obsidian";
import { decideRewrite } from "./pipeline";
import { resolveAlias } from "./alias-resolver";
import {
	buildExcludedRanges,
	getLinkpathForResolution,
	isEmbed,
	isInsideInlineCode,
	isInsideSection,
	toLinkInput,
} from "./link-filter";
import type { AliasHubSettings } from "./settings";

/** Stats returned after a bulk write operation. */
export interface BulkWriteStats {
	filesProcessed: number;
	updated: number;
	skipped: number;
}

const YIELD_INTERVAL = 50;

interface PlannedRewrite {
	startOffset: number;
	endOffset: number;
	original: string;
	newText: string;
}

/**
 * Check if a file path should be ignored based on the ignored folders list.
 * Uses prefix matching.
 */
function isIgnored(filePath: string, ignoredFolders: string[]): boolean {
	for (const folder of ignoredFolders) {
		if (filePath.startsWith(folder + "/") || filePath === folder) {
			return true;
		}
	}
	return false;
}

/**
 * Collect all markdown files in a folder recursively.
 */
function collectMarkdownFiles(folder: TFolder): TFile[] {
	const files: TFile[] = [];
	Vault.recurseChildren(folder, (child: TAbstractFile) => {
		if (child instanceof TFile && child.extension === "md") {
			files.push(child);
		}
	});
	return files;
}

/**
 * Pre-filter phase: determine which rewrites are needed for a single file
 * using only the metadata cache (no file I/O).
 */
function planRewrites(
	app: App,
	file: TFile,
	settings: AliasHubSettings,
): PlannedRewrite[] {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.links || cache.links.length === 0) return [];

	const excludedRanges = buildExcludedRanges(cache.sections);
	const planned: PlannedRewrite[] = [];

	for (const link of cache.links) {
		const startOffset = link.position.start.offset;
		const endOffset = link.position.end.offset;

		if (isInsideSection(startOffset, endOffset, excludedRanges)) continue;

		const linkpath = getLinkpathForResolution(link);
		const { alias } = resolveAlias(app, linkpath, file.path);
		const input = toLinkInput(link, alias, settings);

		const decision = decideRewrite(input);
		if (decision.action === "rewrite") {
			planned.push({
				startOffset,
				endOffset,
				original: link.original,
				newText: decision.newText,
			});
		}
	}

	return planned;
}

/**
 * Apply planned rewrites to file content inside vault.process().
 * Verifies each rewrite against actual content before applying.
 * Skips inline code and embed links using content inspection.
 * Works in reverse offset order to preserve positions.
 */
function applyRewrites(content: string, planned: PlannedRewrite[]): { content: string; applied: number } {
	const sorted = [...planned].sort((a, b) => b.startOffset - a.startOffset);
	let result = content;
	let applied = 0;

	for (const rewrite of sorted) {
		const actual = result.slice(rewrite.startOffset, rewrite.endOffset);
		if (actual !== rewrite.original) continue;

		if (isInsideInlineCode(result, rewrite.startOffset, rewrite.endOffset)) continue;
		if (isEmbed(result, rewrite.startOffset)) continue;

		result =
			result.slice(0, rewrite.startOffset) +
			rewrite.newText +
			result.slice(rewrite.endOffset);
		applied++;
	}

	return { content: result, applied };
}

/**
 * Yield control to the UI to prevent blocking.
 */
function yieldToUI(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Update all links in a folder recursively. */
export async function updateLinksInFolder(
	app: App,
	folder: TFolder,
	settings: AliasHubSettings,
): Promise<BulkWriteStats> {
	const files = collectMarkdownFiles(folder).filter(
		(f) => !isIgnored(f.path, settings.ignoredFolders),
	);
	return executeBulk(app, files, settings);
}

/** Update all links in the vault. */
export async function updateLinksInVault(
	app: App,
	settings: AliasHubSettings,
): Promise<BulkWriteStats> {
	const files = app.vault.getMarkdownFiles().filter(
		(f) => !isIgnored(f.path, settings.ignoredFolders),
	);
	return executeBulk(app, files, settings);
}

/**
 * Execute bulk rewrites across a set of files.
 * Pre-filters using cache, then applies via vault.process().
 */
async function executeBulk(
	app: App,
	files: TFile[],
	settings: AliasHubSettings,
): Promise<BulkWriteStats> {
	const plan = new Map<TFile, PlannedRewrite[]>();

	for (const file of files) {
		const rewrites = planRewrites(app, file, settings);
		if (rewrites.length > 0) {
			plan.set(file, rewrites);
		}
	}

	let totalUpdated = 0;
	let totalSkipped = 0;
	let filesProcessed = 0;
	let count = 0;

	for (const [file, planned] of plan) {
		await app.vault.process(file, (content) => {
			const { content: newContent, applied } = applyRewrites(
				content,
				planned,
			);
			totalUpdated += applied;
			totalSkipped += planned.length - applied;
			filesProcessed++;
			return newContent;
		});

		count++;
		if (count % YIELD_INTERVAL === 0) {
			await yieldToUI();
		}
	}

	return { filesProcessed, updated: totalUpdated, skipped: totalSkipped };
}
