import { describe, expect, it, vi } from "vitest";
import {
	applyChangesInEditor,
	skipReasonMessage,
	type PlannedChange,
} from "../src/editor-writer";

describe("skipReasonMessage", () => {
	it("returns correct message for no-alias", () => {
		expect(skipReasonMessage("no-alias")).toBe("No alias found for target");
	});

	it("returns correct message for has-display-text", () => {
		expect(skipReasonMessage("has-display-text")).toBe(
			"Skipped — display text already set",
		);
	});

	it("returns correct message for already-correct", () => {
		expect(skipReasonMessage("already-correct")).toBe(
			"Link already up to date",
		);
	});
});

describe("applyChangesInEditor", () => {
	it("applies changes in reverse offset order to preserve positions", () => {
		const content = "text [[a]] mid [[b]] end";
		const replaceRange = vi.fn();
		const editor = {
			getValue: () => content,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			replaceRange,
		} as any;

		const changes: PlannedChange[] = [
			{ from: 5, to: 10, original: "[[a]]", newText: "[[a|A]]" },
			{ from: 15, to: 20, original: "[[b]]", newText: "[[b|B]]" },
		];

		const applied = applyChangesInEditor(editor, changes);
		expect(applied).toBe(2);
		// Reverse order so earlier offsets don't shift.
		expect(replaceRange).toHaveBeenNthCalledWith(
			1,
			"[[b|B]]",
			{ line: 0, ch: 15 },
			{ line: 0, ch: 20 },
		);
		expect(replaceRange).toHaveBeenNthCalledWith(
			2,
			"[[a|A]]",
			{ line: 0, ch: 5 },
			{ line: 0, ch: 10 },
		);
	});

	it("skips a change whose original no longer matches the editor content", () => {
		const content = "text [[a]] end";
		const replaceRange = vi.fn();
		const editor = {
			getValue: () => content,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			replaceRange,
		} as any;
		const changes: PlannedChange[] = [
			{ from: 5, to: 10, original: "[[b]]", newText: "[[b|B]]" },
		];
		expect(applyChangesInEditor(editor, changes)).toBe(0);
		expect(replaceRange).not.toHaveBeenCalled();
	});

	it("returns 0 for empty change list", () => {
		const editor = { getValue: () => "", offsetToPos: vi.fn(), replaceRange: vi.fn() } as any;
		expect(applyChangesInEditor(editor, [])).toBe(0);
	});
});
