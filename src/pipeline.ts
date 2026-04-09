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

/** Input to the propagate decision function. */
export interface PropagateInput {
	/** Raw wikilink text, e.g. "[[file#heading|Old Alias]]" or "![[file|Old]]" */
	original: string;
	/** Whether the original contains an explicit "|" separator */
	hasExplicitDisplayText: boolean;
	/** Current display text if present, else null */
	currentDisplayText: string | null;
	/** Full aliases array from the target file (may be empty) */
	aliases: string[];
	/** Match case-insensitively? */
	caseInsensitive: boolean;
}

/** Input to the remove decision function. */
export interface RemoveInput {
	/** Raw wikilink text */
	original: string;
	/** Whether the original contains an explicit "|" separator */
	hasExplicitDisplayText: boolean;
	/** Current display text if present, else null */
	currentDisplayText: string | null;
	/** Full aliases array from the target file (may be empty) */
	aliases: string[];
	/** Match case-insensitively? */
	caseInsensitive: boolean;
	/** Aggressive mode strips regardless of alias match */
	aggressive: boolean;
}

/**
 * Decide whether to propagate a target's canonical alias into this backlink.
 *
 * Eligibility: display text is a known alias of the target (canonical or
 * historical) AND is not already the canonical form. Prose display text
 * is never touched (safe-rewrite rule).
 *
 * Bare links `[[file]]` are rewritten to `[[file|aliases[0]]]` when a
 * canonical alias exists — propagation treats "no display text" as
 * implicitly eligible for the canonical alias.
 *
 * Anchors are preserved via extractLinkPath.
 */
export function decidePropagate(input: PropagateInput): RewriteDecision {
	const canonical = input.aliases[0];
	if (canonical === undefined || canonical === "") {
		return { action: "skip", reason: "no-alias" };
	}

	// Bare link — rewrite to canonical.
	if (!input.hasExplicitDisplayText || input.currentDisplayText === null) {
		const linkPath = extractLinkPath(input.original);
		const prefix = input.original.startsWith("!") ? "!" : "";
		return {
			action: "rewrite",
			newText: `${prefix}[[${linkPath}|${canonical}]]`,
		};
	}

	// Strict equality with canonical — even in case-insensitive mode, a casing
	// mismatch must rewrite so the display normalizes to canonical casing.
	if (input.currentDisplayText === canonical) {
		return { action: "skip", reason: "already-correct" };
	}

	if (!isAliasMatch(input.currentDisplayText, input.aliases, input.caseInsensitive)) {
		// Prose — safe-rewrite rule preserves it.
		return { action: "skip", reason: "has-display-text" };
	}

	const linkPath = extractLinkPath(input.original);
	const prefix = input.original.startsWith("!") ? "!" : "";
	return {
		action: "rewrite",
		newText: `${prefix}[[${linkPath}|${canonical}]]`,
	};
}

/**
 * Decide whether to strip a link's display text.
 *
 * Safe mode: only strip if display text matches some alias entry.
 * Aggressive mode: strip any explicit display text regardless of match.
 *
 * Bare links (no display text) are skipped as "already-correct" — nothing
 * to remove.
 *
 * Anchors are preserved via extractLinkPath.
 */
export function decideRemove(input: RemoveInput): RewriteDecision {
	if (!input.hasExplicitDisplayText || input.currentDisplayText === null) {
		return { action: "skip", reason: "already-correct" };
	}

	if (!input.aggressive) {
		if (!isAliasMatch(input.currentDisplayText, input.aliases, input.caseInsensitive)) {
			return { action: "skip", reason: "has-display-text" };
		}
	}

	const linkPath = extractLinkPath(input.original);
	const prefix = input.original.startsWith("!") ? "!" : "";
	return {
		action: "rewrite",
		newText: `${prefix}[[${linkPath}]]`,
	};
}
