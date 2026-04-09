/** Input to the rewrite decision function. */
export interface LinkInput {
	/** Raw wikilink text, e.g. "[[file#heading|Text]]" */
	original: string;
	/** Whether the original contains an explicit "|" separator */
	hasExplicitDisplayText: boolean;
	/** The explicit display text if present, else null */
	currentDisplayText: string | null;
	/** aliases[0] from the target file, or null */
	targetAlias: string | null;
	/** Whether to overwrite existing display text */
	overwriteExisting: boolean;
}

export type SkipReason = "no-alias" | "already-correct" | "has-display-text";

export type RewriteDecision =
	| { action: "skip"; reason: SkipReason }
	| { action: "rewrite"; newText: string };

/**
 * Extract the link path (including any subpath) from raw wikilink text.
 * Given "[[path/file#heading|Display]]", returns "path/file#heading".
 */
export function extractLinkPath(original: string): string {
	const inner = original.slice(2, -2);
	const pipeIndex = inner.indexOf("|");
	return pipeIndex === -1 ? inner : inner.slice(0, pipeIndex);
}

/** Decide whether a wikilink should be rewritten with an alias. */
export function decideRewrite(input: LinkInput): RewriteDecision {
	if (input.targetAlias === null) {
		return { action: "skip", reason: "no-alias" };
	}

	if (
		input.hasExplicitDisplayText &&
		input.currentDisplayText === input.targetAlias
	) {
		return { action: "skip", reason: "already-correct" };
	}

	if (input.hasExplicitDisplayText && !input.overwriteExisting) {
		return { action: "skip", reason: "has-display-text" };
	}

	const linkPath = extractLinkPath(input.original);
	return {
		action: "rewrite",
		newText: `[[${linkPath}|${input.targetAlias}]]`,
	};
}

/**
 * Is this display text the current canonical alias?
 *
 * v0.1.0: strict equals aliases[0]. Empty canonical ("") never matches.
 *
 * Future privileged-set upgrade (v0.4.0+): test membership in
 * aliases.slice(0, keepCount). The call sites and the companion
 * isAliasMatch predicate must remain untouched — that is the
 * load-bearing separation.
 */
export function isCanonicalAlias(
	displayText: string,
	aliases: string[],
	caseInsensitive: boolean,
): boolean {
	const canonical = aliases[0];
	if (canonical === undefined || canonical === "") return false;
	if (caseInsensitive) {
		return displayText.toLowerCase() === canonical.toLowerCase();
	}
	return displayText === canonical;
}

/**
 * Is this display text a known alias (canonical OR historical)?
 *
 * Tests membership in the full aliases array. Used by the safe-rewrite
 * rule that both propagate and remove consume. Empty strings never match.
 *
 * This predicate is deliberately distinct from isCanonicalAlias so the
 * privileged-set upgrade can change canonical logic without touching
 * the match logic.
 */
export function isAliasMatch(
	displayText: string,
	aliases: string[],
	caseInsensitive: boolean,
): boolean {
	if (displayText === "") return false;
	if (caseInsensitive) {
		const target = displayText.toLowerCase();
		return aliases.some((a) => a !== "" && a.toLowerCase() === target);
	}
	return aliases.some((a) => a !== "" && a === displayText);
}
