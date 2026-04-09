import {
	type App,
	type CachedMetadata,
	type Editor,
	TFile,
	type TFolder,
	Vault,
} from "obsidian";
import {
	decidePropagate,
	type PropagateInput,
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
import { applyChangesInEditor, type PlannedChange } from "./editor-writer";
import { applyChangesInVault } from "./vault-writer";
import type { YesAliasesSettings } from "./settings";

/** Stats returned from a propagate operation. */
export interface PropagateStats {
	/** Number of target files processed (folder/vault scopes; always 1 for file scope). */
	targetsProcessed: number;
	/** Number of source files whose contents were modified. */
	filesTouched: number;
	/** Number of backlink rewrites applied. */
	linksRewritten: number;
	/** Number of candidates skipped (e.g., prose display text). */
	skipped: number;
}

/** Source of the propagation call — governs notice suppression. */
export interface PropagateOptions {
	source: "manual" | "auto";
	/** Called before each file write so callers can seed the in-flight write tracker. */
	onBeforeWrite?: (sourcePath: string) => void;
}

/** Is this file path under any ignored folder? (Prefix-matched, same semantics as vault-writer.) */
function isIgnored(filePath: string, ignoredFolders: string[]): boolean {
	for (const folder of ignoredFolders) {
		if (filePath.startsWith(folder + "/") || filePath === folder) return true;
	}
	return false;
}

/** Is this an `.md` TFile? Tests instantiate `new TFile()` instances so the check works under mocks. */
function isMarkdownFile(f: unknown): f is TFile {
	return f instanceof TFile && f.extension === "md";
}

/** Run the propagate decision for a single link. */
function decideForLink(
	original: string,
	aliases: string[],
	settings: YesAliasesSettings,
): RewriteDecision {
	const pipeIdx = original.indexOf("|");
	const hasExplicit = pipeIdx !== -1;
	const currentDisplayText = hasExplicit ? original.slice(pipeIdx + 1, -2) : null;
	const input: PropagateInput = {
		original,
		hasExplicitDisplayText: hasExplicit,
		currentDisplayText,
		aliases,
		caseInsensitive: settings.caseInsensitiveAliasMatch,
	};
	return decidePropagate(input);
}

/** Plan body-link propagation changes for a single source file against a single target. */
function planBodyChanges(
	app: App,
	targetFile: TFile,
	targetAliases: string[],
	sourceFile: TFile,
	cache: CachedMetadata | null,
	settings: YesAliasesSettings,
): { changes: PlannedChange[]; skipped: number } {
	if (!cache?.links || cache.links.length === 0) return { changes: [], skipped: 0 };

	const changes: PlannedChange[] = [];
	let skipped = 0;
	const excludedRanges = buildExcludedRanges(cache.sections);

	for (const link of cache.links) {
		// content="" — inline-code detection happens at apply time against real content;
		// section-overlap and preserveHeadingAndBlockAnchors only need link.original/position.
		if (isLinkExcluded(link, "", excludedRanges, settings)) continue;

		const linkpath = getLinkpathForResolution(link);
		const resolved = app.metadataCache.getFirstLinkpathDest(linkpath, sourceFile.path);
		if (resolved?.path !== targetFile.path) continue;

		const decision = decideForLink(link.original, targetAliases, settings);
		if (decision.action === "skip") {
			if (decision.reason === "has-display-text") skipped++;
			continue;
		}
		changes.push({
			from: link.position.start.offset,
			to: link.position.end.offset,
			original: link.original,
			newText: decision.newText,
		});
	}

	return { changes, skipped };
}

/** Is a file currently open in any markdown view? Returns the editor if so, else null. */
function findOpenEditor(app: App, file: TFile): Editor | null {
	let found: Editor | null = null;
	app.workspace.iterateAllLeaves((leaf) => {
		const view = leaf.view as { file?: TFile; editor?: Editor };
		if (view?.file?.path === file.path && view.editor) {
			found = view.editor;
		}
	});
	return found;
}

/** Resolve frontmatter-link offsets against a known content string. */
function resolveFmOffsets(
	content: string,
	fmPlanned: { original: string; newText: string }[],
	yamlStart: number,
	yamlEnd: number,
): PlannedChange[] {
	const out: PlannedChange[] = [];
	const searchFrom = new Map<string, number>();
	for (const fm of fmPlanned) {
		const startFrom = searchFrom.get(fm.original) ?? yamlStart;
		const offset = findFrontmatterLinkOffset(content, fm.original, startFrom, yamlEnd);
		if (!offset) continue;
		searchFrom.set(fm.original, offset.end);
		out.push({
			from: offset.start,
			to: offset.end,
			original: fm.original,
			newText: fm.newText,
		});
	}
	return out;
}

/** Plan + apply propagation for one source file, dispatching to editor or vault path. */
async function propagateSource(
	app: App,
	targetFile: TFile,
	targetAliases: string[],
	sourceFile: TFile,
	settings: YesAliasesSettings,
	options: PropagateOptions,
): Promise<{ applied: number; skipped: number }> {
	const cache = app.metadataCache.getFileCache(sourceFile);
	const { changes: bodyChanges, skipped } = planBodyChanges(
		app,
		targetFile,
		targetAliases,
		sourceFile,
		cache,
		settings,
	);

	// Frontmatter collection — emits {original, newText} pairs; offsets resolved later
	// against actual content (cannot be derived from metadata alone).
	const fmPlanned: { original: string; newText: string }[] = [];
	if (
		settings.updateFrontmatterLinks &&
		cache?.frontmatterLinks &&
		cache.frontmatterLinks.length > 0
	) {
		for (const link of cache.frontmatterLinks) {
			const linkpath = getLinkpathFromFrontmatterLink(link);
			const resolved = app.metadataCache.getFirstLinkpathDest(linkpath, sourceFile.path);
			if (resolved?.path !== targetFile.path) continue;

			const decision = decideForLink(link.original, targetAliases, settings);
			if (decision.action === "rewrite") {
				fmPlanned.push({ original: link.original, newText: decision.newText });
			}
		}
	}

	if (bodyChanges.length === 0 && fmPlanned.length === 0) {
		return { applied: 0, skipped };
	}

	// Call the in-flight hook before any write.
	options.onBeforeWrite?.(sourceFile.path);

	const openEditor = findOpenEditor(app, sourceFile);

	if (openEditor) {
		// Editor path: resolve frontmatter offsets against editor.getValue() if needed.
		const fmChanges: PlannedChange[] =
			fmPlanned.length > 0
				? (() => {
						const yamlRange = getYamlSectionRange(cache?.sections);
						if (!yamlRange) return [];
						return resolveFmOffsets(
							openEditor.getValue(),
							fmPlanned,
							yamlRange.start,
							yamlRange.end,
						);
					})()
				: [];
		const applied = applyChangesInEditor(openEditor, [...bodyChanges, ...fmChanges]);
		return { applied, skipped };
	}

	// Vault path: closed file. Only read content if frontmatter offset resolution is needed —
	// body changes already carry their own offsets and applyChangesInVault verifies them
	// against the actual content inside vault.process().
	let fmChanges: PlannedChange[] = [];
	if (fmPlanned.length > 0) {
		const yamlRange = getYamlSectionRange(cache?.sections);
		if (yamlRange) {
			const content = await app.vault.read(sourceFile);
			fmChanges = resolveFmOffsets(content, fmPlanned, yamlRange.start, yamlRange.end);
		}
	}

	const applied = await applyChangesInVault(app, sourceFile, [...bodyChanges, ...fmChanges]);
	return { applied, skipped };
}

/**
 * Propagate a single target file's aliases to all its backlinks in the vault.
 *
 * Reverse-lookup via `metadataCache.resolvedLinks`, which is keyed as
 * `resolvedLinks[sourcePath] → { targetPath: count }`. We iterate all entries
 * to find sources linking to this target — sub-millisecond even on 10k vaults.
 */
export async function propagateFile(
	app: App,
	targetFile: TFile,
	settings: YesAliasesSettings,
	options: PropagateOptions,
): Promise<PropagateStats> {
	const stats: PropagateStats = {
		targetsProcessed: 1,
		filesTouched: 0,
		linksRewritten: 0,
		skipped: 0,
	};

	const targetAliases = getAllAliases(app, targetFile);
	if (targetAliases.length === 0 || targetAliases[0] === "") return stats;

	const sources = new Set<string>();
	for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
		if (targets[targetFile.path]) {
			sources.add(sourcePath);
		}
	}

	for (const sourcePath of sources) {
		if (isIgnored(sourcePath, settings.ignoredFolders)) continue;
		const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
		if (!isMarkdownFile(sourceFile)) continue;

		const { applied, skipped } = await propagateSource(
			app,
			targetFile,
			targetAliases,
			sourceFile,
			settings,
			options,
		);
		if (applied > 0) {
			stats.filesTouched++;
			stats.linksRewritten += applied;
		}
		stats.skipped += skipped;
	}

	return stats;
}

/** Propagate aliases for every markdown file in a folder (recursive). */
export async function propagateFolder(
	app: App,
	folder: TFolder,
	settings: YesAliasesSettings,
	options: PropagateOptions,
): Promise<PropagateStats> {
	const targets: TFile[] = [];
	Vault.recurseChildren(folder, (child) => {
		if (isMarkdownFile(child)) targets.push(child);
	});

	const aggregate: PropagateStats = {
		targetsProcessed: 0,
		filesTouched: 0,
		linksRewritten: 0,
		skipped: 0,
	};

	for (const target of targets) {
		const s = await propagateFile(app, target, settings, options);
		aggregate.targetsProcessed += s.targetsProcessed;
		aggregate.filesTouched += s.filesTouched;
		aggregate.linksRewritten += s.linksRewritten;
		aggregate.skipped += s.skipped;
	}

	return aggregate;
}

/**
 * Propagate aliases for every markdown file in the vault.
 *
 * Targets in ignoredFolders are SKIPPED ENTIRELY (§15 resolution 4) — users
 * who want a specific ignored file propagated must run the file-scope
 * command explicitly. Source iteration inside propagateFile already filters
 * ignored folders, so ignored-folder source files are never touched either.
 *
 * Yields to the UI every 50 targets for large vaults.
 */
export async function propagateVault(
	app: App,
	settings: YesAliasesSettings,
	options: PropagateOptions,
): Promise<PropagateStats> {
	const allFiles = app.vault.getMarkdownFiles();
	const targets = allFiles.filter((f) => !isIgnored(f.path, settings.ignoredFolders));

	const aggregate: PropagateStats = {
		targetsProcessed: 0,
		filesTouched: 0,
		linksRewritten: 0,
		skipped: 0,
	};

	const YIELD_INTERVAL = 50;
	let count = 0;
	for (const target of targets) {
		const s = await propagateFile(app, target, settings, options);
		aggregate.targetsProcessed += s.targetsProcessed;
		aggregate.filesTouched += s.filesTouched;
		aggregate.linksRewritten += s.linksRewritten;
		aggregate.skipped += s.skipped;
		count++;
		if (count % YIELD_INTERVAL === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	return aggregate;
}
