import { describe, expect, it } from "vitest";
import { skipReasonMessage } from "../src/editor-writer";

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
