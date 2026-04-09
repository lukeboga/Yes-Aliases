import { describe, expect, it } from "vitest";
import {
	decidePropagate,
	decideRemove,
	decideRewrite,
	extractLinkPath,
	isCanonicalAlias,
	isAliasMatch,
	type LinkInput,
	type PropagateInput,
	type RemoveInput,
} from "../src/pipeline";

function makeInput(overrides: Partial<LinkInput> = {}): LinkInput {
	return {
		original: "[[some-file]]",
		hasExplicitDisplayText: false,
		currentDisplayText: null,
		targetAlias: "My Alias",
		overwriteExisting: false,
		...overrides,
	};
}

describe("decideRewrite", () => {
	it("rewrites a bare link when alias exists", () => {
		const result = decideRewrite(makeInput());
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file|My Alias]]",
		});
	});

	it("skips when target has no alias", () => {
		const result = decideRewrite(makeInput({ targetAlias: null }));
		expect(result).toEqual({
			action: "skip",
			reason: "no-alias",
		});
	});

	it("skips when display text already matches alias", () => {
		const result = decideRewrite(
			makeInput({
				original: "[[some-file|My Alias]]",
				hasExplicitDisplayText: true,
				currentDisplayText: "My Alias",
			}),
		);
		expect(result).toEqual({
			action: "skip",
			reason: "already-correct",
		});
	});

	it("skips existing display text when overwrite is false", () => {
		const result = decideRewrite(
			makeInput({
				original: "[[some-file|Old Text]]",
				hasExplicitDisplayText: true,
				currentDisplayText: "Old Text",
				overwriteExisting: false,
			}),
		);
		expect(result).toEqual({
			action: "skip",
			reason: "has-display-text",
		});
	});

	it("overwrites existing display text when overwrite is true", () => {
		const result = decideRewrite(
			makeInput({
				original: "[[some-file|Old Text]]",
				hasExplicitDisplayText: true,
				currentDisplayText: "Old Text",
				overwriteExisting: true,
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file|My Alias]]",
		});
	});

	it("preserves heading subpath", () => {
		const result = decideRewrite(
			makeInput({ original: "[[some-file#heading]]" }),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file#heading|My Alias]]",
		});
	});

	it("preserves block reference subpath", () => {
		const result = decideRewrite(
			makeInput({ original: "[[some-file#^block-id]]" }),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file#^block-id|My Alias]]",
		});
	});

	it("replaces display text while preserving subpath when overwrite is true", () => {
		const result = decideRewrite(
			makeInput({
				original: "[[some-file#heading|Old Text]]",
				hasExplicitDisplayText: true,
				currentDisplayText: "Old Text",
				overwriteExisting: true,
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file#heading|My Alias]]",
		});
	});

	it("handles folder paths in links", () => {
		const result = decideRewrite(
			makeInput({ original: "[[folder/some-file]]" }),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[folder/some-file|My Alias]]",
		});
	});
});

describe("extractLinkPath", () => {
	it("returns the file name for a bare link", () => {
		expect(extractLinkPath("[[file]]")).toBe("file");
	});

	it("includes heading subpath", () => {
		expect(extractLinkPath("[[file#heading]]")).toBe("file#heading");
	});

	it("includes block reference subpath", () => {
		expect(extractLinkPath("[[file#^block]]")).toBe("file#^block");
	});

	it("strips display text", () => {
		expect(extractLinkPath("[[file|Display]]")).toBe("file");
	});

	it("includes subpath and strips display text", () => {
		expect(extractLinkPath("[[file#heading|Display]]")).toBe("file#heading");
	});

	it("handles folder paths", () => {
		expect(extractLinkPath("[[folder/file]]")).toBe("folder/file");
	});
});

describe("isCanonicalAlias", () => {
	it("returns true when display text equals aliases[0]", () => {
		expect(isCanonicalAlias("Jane Smith", ["Jane Smith", "Jane"], false)).toBe(true);
	});

	it("returns false when display text matches a historical alias", () => {
		expect(isCanonicalAlias("Jane", ["Jane Smith", "Jane"], false)).toBe(false);
	});

	it("returns false when aliases is empty", () => {
		expect(isCanonicalAlias("Anything", [], false)).toBe(false);
	});

	it("returns false when aliases[0] is empty string", () => {
		expect(isCanonicalAlias("", ["", "Jane"], false)).toBe(false);
	});

	it("is case-sensitive by default", () => {
		expect(isCanonicalAlias("jane smith", ["Jane Smith"], false)).toBe(false);
	});

	it("matches case-insensitively when flag is true", () => {
		expect(isCanonicalAlias("jane smith", ["Jane Smith"], true)).toBe(true);
	});
});

describe("isAliasMatch", () => {
	it("returns true when display text equals the canonical alias", () => {
		expect(isAliasMatch("Jane Smith", ["Jane Smith", "Jane"], false)).toBe(true);
	});

	it("returns true when display text equals a historical alias", () => {
		expect(isAliasMatch("Jane", ["Jane Smith", "Jane"], false)).toBe(true);
	});

	it("returns false when display text does not match any alias entry", () => {
		expect(isAliasMatch("click here", ["Jane Smith", "Jane"], false)).toBe(false);
	});

	it("returns false when aliases is empty", () => {
		expect(isAliasMatch("Anything", [], false)).toBe(false);
	});

	it("skips empty string alias entries", () => {
		expect(isAliasMatch("", ["Jane", ""], false)).toBe(false);
	});

	it("is case-sensitive by default", () => {
		expect(isAliasMatch("jane", ["Jane Smith", "Jane"], false)).toBe(false);
	});

	it("matches case-insensitively when flag is true", () => {
		expect(isAliasMatch("JANE", ["Jane Smith", "Jane"], true)).toBe(true);
	});
});

function makePropagateInput(overrides: Partial<PropagateInput> = {}): PropagateInput {
	return {
		original: "[[some-file|Jane]]",
		hasExplicitDisplayText: true,
		currentDisplayText: "Jane",
		aliases: ["Jane Smith", "Jane"],
		caseInsensitive: false,
		...overrides,
	};
}

describe("decidePropagate", () => {
	it("rewrites a historical-alias display text to aliases[0]", () => {
		expect(decidePropagate(makePropagateInput())).toEqual({
			action: "rewrite",
			newText: "[[some-file|Jane Smith]]",
		});
	});

	it("skips when display text already equals canonical", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file|Jane Smith]]",
				currentDisplayText: "Jane Smith",
			}),
		);
		expect(result).toEqual({ action: "skip", reason: "already-correct" });
	});

	it("skips when display text is prose (no alias match)", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file|click here]]",
				currentDisplayText: "click here",
			}),
		);
		expect(result).toEqual({ action: "skip", reason: "has-display-text" });
	});

	it("skips when target has no aliases", () => {
		const result = decidePropagate(makePropagateInput({ aliases: [] }));
		expect(result).toEqual({ action: "skip", reason: "no-alias" });
	});

	it("skips when canonical is empty string", () => {
		const result = decidePropagate(makePropagateInput({ aliases: ["", "Jane"] }));
		expect(result).toEqual({ action: "skip", reason: "no-alias" });
	});

	it("rewrites bare link `[[some-file]]` to `[[some-file|Jane Smith]]`", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file]]",
				hasExplicitDisplayText: false,
				currentDisplayText: null,
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file|Jane Smith]]",
		});
	});

	it("preserves heading anchor on rewrite", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file#Heading|Jane]]",
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file#Heading|Jane Smith]]",
		});
	});

	it("preserves block-ref anchor on rewrite", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file#^abc|Jane]]",
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file#^abc|Jane Smith]]",
		});
	});

	it("rewrites case-insensitively to canonical casing", () => {
		const result = decidePropagate(
			makePropagateInput({
				original: "[[some-file|jane smith]]",
				currentDisplayText: "jane smith",
				caseInsensitive: true,
			}),
		);
		expect(result).toEqual({
			action: "rewrite",
			newText: "[[some-file|Jane Smith]]",
		});
	});
});

function makeRemoveInput(overrides: Partial<RemoveInput> = {}): RemoveInput {
	return {
		original: "[[some-file|Jane]]",
		hasExplicitDisplayText: true,
		currentDisplayText: "Jane",
		aliases: ["Jane Smith", "Jane"],
		caseInsensitive: false,
		aggressive: false,
		...overrides,
	};
}

describe("decideRemove", () => {
	it("strips display text matching a historical alias in safe mode", () => {
		expect(decideRemove(makeRemoveInput())).toEqual({
			action: "rewrite",
			newText: "[[some-file]]",
		});
	});

	it("strips display text matching canonical in safe mode", () => {
		expect(
			decideRemove(
				makeRemoveInput({
					original: "[[some-file|Jane Smith]]",
					currentDisplayText: "Jane Smith",
				}),
			),
		).toEqual({ action: "rewrite", newText: "[[some-file]]" });
	});

	it("skips prose display text in safe mode", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file|click here]]",
				currentDisplayText: "click here",
			}),
		);
		expect(result).toEqual({ action: "skip", reason: "has-display-text" });
	});

	it("strips prose display text in aggressive mode", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file|click here]]",
				currentDisplayText: "click here",
				aggressive: true,
			}),
		);
		expect(result).toEqual({ action: "rewrite", newText: "[[some-file]]" });
	});

	it("skips link with no display text", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file]]",
				hasExplicitDisplayText: false,
				currentDisplayText: null,
			}),
		);
		expect(result).toEqual({ action: "skip", reason: "already-correct" });
	});

	it("preserves heading anchor on strip", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file#Heading|Jane]]",
			}),
		);
		expect(result).toEqual({ action: "rewrite", newText: "[[some-file#Heading]]" });
	});

	it("preserves block anchor on strip", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file#^abc|Jane]]",
			}),
		);
		expect(result).toEqual({ action: "rewrite", newText: "[[some-file#^abc]]" });
	});

	it("safe mode with case-insensitive matches historical alias", () => {
		const result = decideRemove(
			makeRemoveInput({
				original: "[[some-file|JANE]]",
				currentDisplayText: "JANE",
				caseInsensitive: true,
			}),
		);
		expect(result).toEqual({ action: "rewrite", newText: "[[some-file]]" });
	});
});
