import {
	type App,
	type CachedMetadata,
	type TFile,
	parseFrontMatterAliases,
	parseFrontMatterStringArray,
} from "obsidian";

/** Result of resolving a link's target alias. */
export interface AliasResult {
	/** The resolved target file, or null if the link is broken. */
	targetFile: TFile | null;
	/** The first alias from the target's frontmatter, or null. */
	alias: string | null;
}

/**
 * Extract aliases from frontmatter, handling both `aliases` and `alias` keys.
 * `parseFrontMatterAliases` only recognizes the `aliases` key;
 * we fall back to `parseFrontMatterStringArray` with `alias` for the singular form.
 */
export function extractAliases(
	frontmatter: Record<string, unknown>,
): string[] | null {
	return (
		parseFrontMatterAliases(frontmatter) ??
		parseFrontMatterStringArray(frontmatter, "alias")
	);
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

	const aliases = extractAliases(cache.frontmatter);
	const firstAlias = aliases?.[0] ?? null;

	return { targetFile, alias: firstAlias };
}

/**
 * Get the full aliases array for a file. Returns [] when no frontmatter,
 * no aliases key, or a broken file. Handles both `aliases` (plural) and
 * `alias` (singular) keys via extractAliases.
 */
export function getAllAliases(app: App, file: TFile): string[] {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.frontmatter) return [];
	return extractAliases(cache.frontmatter) ?? [];
}
