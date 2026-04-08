import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseFrontMatterAliases, parseFrontMatterStringArray } from "obsidian";
import { extractAliases } from "../src/alias-resolver";

const mockPFMA = vi.mocked(parseFrontMatterAliases);
const mockPFMSA = vi.mocked(parseFrontMatterStringArray);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("extractAliases", () => {
	it("returns aliases from parseFrontMatterAliases when present", () => {
		mockPFMA.mockReturnValue(["First", "Second"]);

		const result = extractAliases({ aliases: ["First", "Second"] });

		expect(result).toEqual(["First", "Second"]);
		expect(mockPFMSA).not.toHaveBeenCalled();
	});

	it("falls back to parseFrontMatterStringArray with 'alias' key", () => {
		mockPFMA.mockReturnValue(null);
		mockPFMSA.mockReturnValue(["Singular"]);

		const result = extractAliases({ alias: "Singular" });

		expect(result).toEqual(["Singular"]);
		expect(mockPFMSA).toHaveBeenCalledWith({ alias: "Singular" }, "alias");
	});

	it("returns null when neither key is present", () => {
		mockPFMA.mockReturnValue(null);
		mockPFMSA.mockReturnValue(null);

		const result = extractAliases({});

		expect(result).toBeNull();
	});

	it("prefers aliases (plural) over alias (singular)", () => {
		mockPFMA.mockReturnValue(["Plural"]);

		const result = extractAliases({
			aliases: ["Plural"],
			alias: "Singular",
		});

		expect(result).toEqual(["Plural"]);
		expect(mockPFMSA).not.toHaveBeenCalled();
	});
});
