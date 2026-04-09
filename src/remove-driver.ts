import { type App, type Editor, TFile, type TFolder, Vault } from "obsidian";
import {
	decideRemove,
	type RemoveInput,
	type RewriteDecision,
} from "./pipeline";
import { getAllAliases } from "./alias-resolver";
import {
	buildExcludedRanges,
	findFrontmatterLinkOffset,
	getLinkpathForResolution,
	getLinkpathFromFrontmatterLink,
	getYamlSectionRange,
	isLinkExcluded,
} from "./link-filter";
import {
	applyChangesInEditor,
	type PlannedChange,
} from "./editor-writer";
import { applyChangesInVault } from "./vault-writer";
import type { YesAliasesSettings } from "./settings";

export interface RemoveResult {
	found: boolean;
	message: string;
}

export interface RemoveFileStats {
	updated: number;
	skipped: number;
}

export interface RemoveBulkStats {
	filesProcessed: number;
	updated: number;
	skipped: number;
}

export interface RemoveOptions {
	/** Restrict to links resolving to this target file only. */
	targetFile?: TFile;
	/** Restrict to frontmatter links only (Properties UI path). */
	frontmatterOnly?: boolean;
}

/** Is this an `.md` TFile? Tests instantiate `new TFile()` so the check works under mocks. */
function isMarkdownFile(f: unknown): f is TFile {
	return f instanceof TFile && f.extension === "md";
}

/** Is this file path under any ignored folder? (Prefix-matched.) */
function isIgnored(filePath: string, ignoredFolders: string[]): boolean {
	for (const folder of ignoredFolders) {
		if (filePath.startsWith(folder + "/") || filePath === folder) return true;
	}
	return false;
}

function runRemoveDecision(
	original: string,
	aliases: string[],
	settings: YesAliasesSettings,
): RewriteDecision {
	const pipeIdx = original.indexOf("|");
	const hasExplicit = pipeIdx !== -1;
	const currentDisplayText = hasExplicit ? original.slice(pipeIdx + 1, -2) : null;
	const input: RemoveInput = {
		original,
		hasExplicitDisplayText: hasExplicit,
		currentDisplayText,
		aliases,
		caseInsensitive: settings.caseInsensitiveAliasMatch,
		aggressive: settings.removeIgnoresPropagationSafety,
	};
	return decideRemove(input);
}

function resolveTargetAliases(
	app: App,
	linkpath: string,
	sourcePath: string,
): { targetFile: TFile | null; aliases: string[] } {
	const targetFile = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
	if (!targetFile) return { targetFile: null, aliases: [] };
	return { targetFile, aliases: getAllAliases(app, targetFile) };
}

function skipMessage(reason: string): string {
	switch (reason) {
		case "already-correct":
			return "Link has no display text to remove";
		case "has-display-text":
			return "Skipped — display text is not an alias of the target";
		case "no-alias":
			return "No alias found for target";
		default:
			return "Skipped";
	}
}

/** Remove display text from the single wikilink at the cursor. */
export function removeLinkUnderCursor(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
): RemoveResult {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { found: false, message: "No wikilink under cursor" };

	const cursor = editor.getCursor();
	const cursorOffset = editor.posToOffset(cursor);
	const content = editor.getValue();

	// Body links
	if (cache.links) {
		const excludedRanges = buildExcludedRanges(cache.sections);
		for (const link of cache.links) {
			const s = link.position.start.offset;
			const e = link.position.end.offset;
			if (cursorOffset < s || cursorOffset > e) continue;
			if (isLinkExcluded(link, content, excludedRanges, settings)) continue;

			const linkpath = getLinkpathForResolution(link);
			const { aliases } = resolveTargetAliases(app, linkpath, file.path);

			const decision = runRemoveDecision(link.original, aliases, settings);
			if (decision.action === "skip") {
				return { found: true, message: skipMessage(decision.reason) };
			}
			applyChangesInEditor(editor, [
				{ from: s, to: e, original: link.original, newText: decision.newText },
			]);
			return { found: true, message: "Link alias removed" };
		}
	}

	// Frontmatter links
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
				const { aliases } = resolveTargetAliases(app, linkpath, file.path);
				const decision = runRemoveDecision(link.original, aliases, settings);
				if (decision.action === "skip") {
					return { found: true, message: skipMessage(decision.reason) };
				}
				applyChangesInEditor(editor, [
					{
						from: offset.start,
						to: offset.end,
						original: link.original,
						newText: decision.newText,
					},
				]);
				return { found: true, message: "Link alias removed" };
			}
		}
	}

	return { found: false, message: "No wikilink under cursor" };
}

/** Remove display text from all qualifying links in the active file. */
export function removeLinksInFile(
	app: App,
	editor: Editor,
	file: TFile,
	settings: YesAliasesSettings,
	options: RemoveOptions = {},
): RemoveFileStats {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { updated: 0, skipped: 0 };

	const content = editor.getValue();
	const changes: PlannedChange[] = [];
	let skipped = 0;

	const hasBodyLinks =
		!options.frontmatterOnly && cache.links && cache.links.length > 0;
	const hasFmLinks =
		settings.updateFrontmatterLinks &&
		cache.frontmatterLinks &&
		cache.frontmatterLinks.length > 0;

	if (hasBodyLinks) {
		const excludedRanges = buildExcludedRanges(cache.sections);
		for (const link of cache.links!) {
			if (isLinkExcluded(link, content, excludedRanges, settings)) continue;
			const linkpath = getLinkpathForResolution(link);
			if (options.targetFile) {
				const resolved = app.metadataCache.getFirstLinkpathDest(
					linkpath,
					file.path,
				);
				if (resolved?.path !== options.targetFile.path) continue;
			}
			const { aliases } = resolveTargetAliases(app, linkpath, file.path);
			const decision = runRemoveDecision(link.original, aliases, settings);
			if (decision.action === "skip") {
				if (decision.reason !== "already-correct") skipped++;
				continue;
			}
			changes.push({
				from: link.position.start.offset,
				to: link.position.end.offset,
				original: link.original,
				newText: decision.newText,
			});
		}
	}

	if (hasFmLinks) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			const searchFrom = new Map<string, number>();
			for (const link of cache.frontmatterLinks!) {
				const linkpath = getLinkpathFromFrontmatterLink(link);
				if (options.targetFile) {
					const resolved = app.metadataCache.getFirstLinkpathDest(
						linkpath,
						file.path,
					);
					if (resolved?.path !== options.targetFile.path) continue;
				}
				const { aliases } = resolveTargetAliases(app, linkpath, file.path);
				const decision = runRemoveDecision(link.original, aliases, settings);
				if (decision.action === "skip") {
					if (decision.reason !== "already-correct") skipped++;
					continue;
				}
				const startFrom = searchFrom.get(link.original) ?? yamlRange.start;
				const offset = findFrontmatterLinkOffset(
					content,
					link.original,
					startFrom,
					yamlRange.end,
				);
				if (!offset) continue;
				searchFrom.set(link.original, offset.end);
				changes.push({
					from: offset.start,
					to: offset.end,
					original: link.original,
					newText: decision.newText,
				});
			}
		}
	}

	const updated = applyChangesInEditor(editor, changes);
	return { updated, skipped };
}

/** Plan + apply remove against a closed file via vault.process(). */
async function removeLinksInClosedFile(
	app: App,
	file: TFile,
	settings: YesAliasesSettings,
): Promise<{ applied: number; skipped: number }> {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return { applied: 0, skipped: 0 };

	// Collect decisions from metadata.
	const bodyPlanned: PlannedChange[] = [];
	const fmPlanned: Array<{ original: string; newText: string }> = [];
	let skipped = 0;

	if (cache.links) {
		const excludedRanges = buildExcludedRanges(cache.sections);
		for (const link of cache.links) {
			// content="" — inline-code detection happens at apply time against real content.
			if (isLinkExcluded(link, "", excludedRanges, settings)) continue;
			const linkpath = getLinkpathForResolution(link);
			const { aliases } = resolveTargetAliases(app, linkpath, file.path);
			const decision = runRemoveDecision(link.original, aliases, settings);
			if (decision.action === "skip") {
				if (decision.reason !== "already-correct") skipped++;
				continue;
			}
			bodyPlanned.push({
				from: link.position.start.offset,
				to: link.position.end.offset,
				original: link.original,
				newText: decision.newText,
			});
		}
	}

	if (
		settings.updateFrontmatterLinks &&
		cache.frontmatterLinks &&
		cache.frontmatterLinks.length > 0
	) {
		for (const link of cache.frontmatterLinks) {
			const linkpath = getLinkpathFromFrontmatterLink(link);
			const { aliases } = resolveTargetAliases(app, linkpath, file.path);
			const decision = runRemoveDecision(link.original, aliases, settings);
			if (decision.action === "skip") {
				if (decision.reason !== "already-correct") skipped++;
				continue;
			}
			fmPlanned.push({ original: link.original, newText: decision.newText });
		}
	}

	if (bodyPlanned.length === 0 && fmPlanned.length === 0) {
		return { applied: 0, skipped };
	}

	// Resolve frontmatter offsets against current file content — only when needed.
	const fmChanges: PlannedChange[] = [];
	if (fmPlanned.length > 0) {
		const yamlRange = getYamlSectionRange(cache.sections);
		if (yamlRange) {
			const content = await app.vault.read(file);
			const searchFrom = new Map<string, number>();
			for (const fm of fmPlanned) {
				const startFrom = searchFrom.get(fm.original) ?? yamlRange.start;
				const offset = findFrontmatterLinkOffset(content, fm.original, startFrom, yamlRange.end);
				if (!offset) continue;
				searchFrom.set(fm.original, offset.end);
				fmChanges.push({
					from: offset.start,
					to: offset.end,
					original: fm.original,
					newText: fm.newText,
				});
			}
		}
	}

	const applied = await applyChangesInVault(app, file, [...bodyPlanned, ...fmChanges]);
	return { applied, skipped };
}

/** Remove link aliases from every markdown file in the folder. */
export async function removeLinksInFolder(
	app: App,
	folder: TFolder,
	settings: YesAliasesSettings,
): Promise<RemoveBulkStats> {
	const files: TFile[] = [];
	Vault.recurseChildren(folder, (child) => {
		if (isMarkdownFile(child) && !isIgnored(child.path, settings.ignoredFolders)) {
			files.push(child);
		}
	});
	return executeRemoveBulk(app, files, settings);
}

/** Remove link aliases across every markdown file in the vault. */
export async function removeLinksInVault(
	app: App,
	settings: YesAliasesSettings,
): Promise<RemoveBulkStats> {
	const files = app.vault
		.getMarkdownFiles()
		.filter((f) => !isIgnored(f.path, settings.ignoredFolders));
	return executeRemoveBulk(app, files, settings);
}

async function executeRemoveBulk(
	app: App,
	files: TFile[],
	settings: YesAliasesSettings,
): Promise<RemoveBulkStats> {
	const aggregate: RemoveBulkStats = { filesProcessed: 0, updated: 0, skipped: 0 };
	const YIELD_INTERVAL = 50;
	let count = 0;
	for (const file of files) {
		const { applied, skipped } = await removeLinksInClosedFile(app, file, settings);
		if (applied > 0) {
			aggregate.filesProcessed++;
			aggregate.updated += applied;
		}
		aggregate.skipped += skipped;
		count++;
		if (count % YIELD_INTERVAL === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	return aggregate;
}
