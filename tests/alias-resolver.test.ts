import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseFrontMatterAliases, parseFrontMatterStringArray } from "obsidian";
import { extractAliases, getAllAliases } from "../src/alias-resolver";

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

describe("getAllAliases", () => {
	it("returns the full aliases array from frontmatter", () => {
		const app = {
			metadataCache: {
				getFileCache: vi.fn().mockReturnValue({
					frontmatter: { aliases: ["Jane Smith", "Jane", "Dr. Smith"] },
				}),
			},
		} as any;
		const file = { path: "people/jane.md" } as any;
		mockPFMA.mockReturnValueOnce(["Jane Smith", "Jane", "Dr. Smith"]);
		expect(getAllAliases(app, file)).toEqual(["Jane Smith", "Jane", "Dr. Smith"]);
	});

	it("returns empty array when file has no cache", () => {
		const app = {
			metadataCache: { getFileCache: vi.fn().mockReturnValue(null) },
		} as any;
		expect(getAllAliases(app, { path: "x.md" } as any)).toEqual([]);
	});

	it("returns empty array when frontmatter has no aliases", () => {
		const app = {
			metadataCache: {
				getFileCache: vi.fn().mockReturnValue({ frontmatter: {} }),
			},
		} as any;
		mockPFMA.mockReturnValueOnce(null);
		mockPFMSA.mockReturnValueOnce(null);
		expect(getAllAliases(app, { path: "x.md" } as any)).toEqual([]);
	});

	it("falls back to singular `alias` key", () => {
		const app = {
			metadataCache: {
				getFileCache: vi.fn().mockReturnValue({
					frontmatter: { alias: ["Only One"] },
				}),
			},
		} as any;
		mockPFMA.mockReturnValueOnce(null);
		mockPFMSA.mockReturnValueOnce(["Only One"]);
		expect(getAllAliases(app, { path: "x.md" } as any)).toEqual(["Only One"]);
	});
});
