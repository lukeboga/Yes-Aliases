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
	getLinkpathFromFrontmatterLink,
	getYamlSectionRange,
	isInsideInlineCode,
	isLinkExcluded,
	toLinkInput,
} from "./link-filter";
import type { YesAliasesSettings } from "./settings";

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

export interface FrontmatterRewrite {
	original: string;
	newText: string;
}

/**
 * Apply frontmatter rewrites using bounded string replacement within the YAML section.
 * Deduplicates by original text. Does not modify content outside YAML bounds.
 */
export function applyFrontmatterRewrites(
	content: string,
	rewrites: FrontmatterRewrite[],
	yamlStart: number,
	yamlEnd: number,
): { content: string; applied: number } {
	if (rewrites.length === 0) return { content, applied: 0 };

	const unique = new Map<string, string>();
	for (const r of rewrites) {
		unique.set(r.original, r.newText);
	}

	let frontmatter = content.slice(yamlStart, yamlEnd);
	let applied = 0;

	for (const [original, newText] of unique) {
		let count = 0;
		let idx = frontmatter.indexOf(original);
		while (idx !== -1) {
			count++;
			idx = frontmatter.indexOf(original, idx + original.length);
		}
		if (count > 0) {
			frontmatter = frontmatter.split(original).join(newText);
			applied += count;
		}
	}

	if (applied === 0) return { content, applied: 0 };
	return {
		content: content.slice(0, yamlStart) + frontmatter + content.slice(yamlEnd),
		applied,
	};
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

interface PlannedRewrites {
	body: PlannedRewrite[];
	frontmatter: FrontmatterRewrite[];
	yamlStart: number;
	yamlEnd: number;
}

/**
 * Pre-filter phase: determine which rewrites are needed for a single file
 * using only the metadata cache (no file I/O).
 */
function planRewrites(
	app: App,
	file: TFile,
	settings: YesAliasesSettings,
): PlannedRewrites {
	const cache = app.metadataCache.getFileCache(file);
	const body: PlannedRewrite[] = [];
	const frontmatter: FrontmatterRewrite[] = [];
	let yamlStart = 0;
	let yamlEnd = 0;

	if (cache?.links) {
		const excludedRanges = buildExcludedRanges(cache.sections);
		// planRewrites has no content yet — pass "" so isLinkExcluded only
		// applies the section-overlap and preserveHeadingAndBlockAnchors checks.
		// Inline-code detection happens at apply time against real content.
		const content = "";
		for (const link of cache.links) {
			if (isLinkExcluded(link, content, excludedRanges, settings)) continue;

			const startOffset = link.position.start.offset;
			const endOffset = link.position.end.offset;

			const linkpath = getLinkpathForResolution(link);
			const { alias } = resolveAlias(app, linkpath, file.path);
			const input = toLinkInput(link, alias, settings);

			const decision = decideRewrite(input);
			if (decision.action === "rewrite") {
				body.push({
					startOffset,
					endOffset,
					original: link.original,
					newText: decision.newText,
				});
			}
		}
	}

	if (settings.updateFrontmatterLinks && cache?.frontmatterLinks) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			yamlStart = yamlRange.start;
			yamlEnd = yamlRange.end;
			for (const link of cache.frontmatterLinks) {
				const linkpath = getLinkpathFromFrontmatterLink(link);
				const { alias } = resolveAlias(app, linkpath, file.path);
				const input = toLinkInput(link, alias, settings);

				const decision = decideRewrite(input);
				if (decision.action === "rewrite") {
					frontmatter.push({
						original: link.original,
						newText: decision.newText,
					});
				}
			}
		}
	}

	return { body, frontmatter, yamlStart, yamlEnd };
}

/**
 * Apply planned rewrites to file content inside vault.process().
 * Body rewrites: verifies against actual content, skips inline code and embeds.
 * Frontmatter rewrites: bounded string replacement within YAML section.
 * Body rewrites applied first (higher offsets), then frontmatter (top of file).
 */
function applyRewrites(
	content: string,
	planned: PlannedRewrites,
): { content: string; applied: number } {
	const sorted = [...planned.body].sort((a, b) => b.startOffset - a.startOffset);
	let result = content;
	let applied = 0;

	for (const rewrite of sorted) {
		const actual = result.slice(rewrite.startOffset, rewrite.endOffset);
		if (actual !== rewrite.original) continue;

		if (isInsideInlineCode(content, rewrite.startOffset, rewrite.endOffset)) continue;

		result =
			result.slice(0, rewrite.startOffset) +
			rewrite.newText +
			result.slice(rewrite.endOffset);
		applied++;
	}

	if (planned.frontmatter.length > 0) {
		const fm = applyFrontmatterRewrites(
			result,
			planned.frontmatter,
			planned.yamlStart,
			planned.yamlEnd,
		);
		result = fm.content;
		applied += fm.applied;
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
	settings: YesAliasesSettings,
): Promise<BulkWriteStats> {
	const files = collectMarkdownFiles(folder).filter(
		(f) => !isIgnored(f.path, settings.ignoredFolders),
	);
	return executeBulk(app, files, settings);
}

/** Update all links in the vault. */
export async function updateLinksInVault(
	app: App,
	settings: YesAliasesSettings,
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
	settings: YesAliasesSettings,
): Promise<BulkWriteStats> {
	const plan = new Map<TFile, PlannedRewrites>();

	for (const file of files) {
		const rewrites = planRewrites(app, file, settings);
		if (rewrites.body.length > 0 || rewrites.frontmatter.length > 0) {
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
			totalSkipped += planned.body.length + planned.frontmatter.length - applied;
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

/**
 * Apply a precomputed change list to a closed file via vault.process().
 * Changes applied in reverse offset order with per-change safety check.
 *
 * Returns the number of changes successfully applied. If the list is
 * empty, vault.process is never called (no mtime bump).
 */
export async function applyChangesInVault(
	app: App,
	file: TFile,
	changes: import("./editor-writer").PlannedChange[],
): Promise<number> {
	if (changes.length === 0) return 0;
	let applied = 0;
	await app.vault.process(file, (content) => {
		const sorted = [...changes].sort((a, b) => b.from - a.from);
		let result = content;
		for (const change of sorted) {
			const actual = result.slice(change.from, change.to);
			if (actual !== change.original) continue;
			result = result.slice(0, change.from) + change.newText + result.slice(change.to);
			applied++;
		}
		return result;
	});
	return applied;
}
