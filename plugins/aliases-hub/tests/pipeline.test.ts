import { describe, expect, it } from "vitest";
import { decideRewrite, type LinkInput } from "../src/pipeline";

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
