import {
	type App,
	type CachedMetadata,
	type TFile,
	parseFrontMatterAliases,
} from "obsidian";

/** Result of resolving a link's target alias. */
export interface AliasResult {
	/** The resolved target file, or null if the link is broken. */
	targetFile: TFile | null;
	/** The first alias from the target's frontmatter, or null. */
	alias: string | null;
}

/** Resolve a wikilink's target file and retrieve its first alias. */
export function resolveAlias(
	app: App,
	linkpath: string,
	sourcePath: string,
): AliasResult {
	const targetFile = app.metadataCache.getFirstLinkpathDest(
		linkpath,
		sourcePath,
	);
	if (!targetFile) {
		return { targetFile: null, alias: null };
	}

	const cache: CachedMetadata | null =
		app.metadataCache.getFileCache(targetFile);
	if (!cache?.frontmatter) {
		return { targetFile, alias: null };
	}

	const aliases = parseFrontMatterAliases(cache.frontmatter);
	const firstAlias = aliases?.[0] ?? null;

	return { targetFile, alias: firstAlias };
}
