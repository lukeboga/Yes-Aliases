import { describe, expect, it, vi, beforeEach } from "vitest";
import { detectCompressOrphans } from "../src/compress";
import type { YesAliasesSettings } from "../src/settings";
import {
	parseFrontMatterAliases,
	parseFrontMatterStringArray,
	TFile,
} from "obsidian";

/** Build a TFile-instance test fixture so `instanceof TFile` checks pass under the mock. */
function makeTFile(path: string, extension = "md"): TFile {
	const f = new TFile();
	f.path = path;
	f.extension = extension;
	return f;
}

function makeSettings(partial: Partial<YesAliasesSettings> = {}): YesAliasesSettings {
	return {
		overwriteExisting: false,
		updateFrontmatterLinks: true,
		ignoredFolders: [],
		preserveHeadingAndBlockAnchors: false,
		caseInsensitiveAliasMatch: false,
		autoPropagateNewNoteAliases: true,
		autoPropagateAllAliasChanges: false,
		autoPropagateNoticeThreshold: 5,
		aliasesKeepCount: 1,
		compressWarnInsteadOfBlock: false,
		removeIgnoresPropagationSafety: false,
		...partial,
	};
}

beforeEach(() => {
	(parseFrontMatterAliases as any).mockReset();
	(parseFrontMatterStringArray as any).mockReset();
});

describe("detectCompressOrphans", () => {
	it("returns empty orphan list when no aliases would be stripped", () => {
		const target = makeTFile("jane.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn(() => ({ frontmatter: { aliases: ["Jane"] } })),
				resolvedLinks: {},
				getFirstLinkpathDest: vi.fn(),
			},
			vault: { getAbstractFileByPath: vi.fn() },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane"]);
		const result = detectCompressOrphans(app, target, 1, makeSettings());
		expect(result.orphans).toHaveLength(0);
		expect(result.strippedEntries).toEqual([]);
	});

	it("finds orphan backlinks that use a stripped alias", () => {
		const target = makeTFile("jane.md");
		const source = makeTFile("a.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === target.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					if (f.path === source.path) {
						return {
							links: [
								{
									original: "[[jane|Jane]]",
									position: { start: { offset: 0 }, end: { offset: 13 } },
								},
							],
							sections: [],
						};
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn(() => target),
				resolvedLinks: { "a.md": { "jane.md": 1 } },
			},
			vault: {
				getAbstractFileByPath: vi.fn(() => source),
			},
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith", "Jane"]);

		const result = detectCompressOrphans(app, target, 1, makeSettings());
		expect(result.strippedEntries).toEqual(["Jane"]);
		expect(result.orphans).toHaveLength(1);
		expect(result.orphans[0].sourcePath).toBe("a.md");
	});

	it("ignores prose display text when looking for orphans", () => {
		const target = makeTFile("jane.md");
		const source = makeTFile("a.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === target.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					if (f.path === source.path) {
						return {
							links: [
								{
									original: "[[jane|click here]]",
									position: { start: { offset: 0 }, end: { offset: 19 } },
								},
							],
							sections: [],
						};
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn(() => target),
				resolvedLinks: { "a.md": { "jane.md": 1 } },
			},
			vault: { getAbstractFileByPath: vi.fn(() => source) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith", "Jane"]);

		const result = detectCompressOrphans(app, target, 1, makeSettings());
		expect(result.orphans).toHaveLength(0);
	});
});
