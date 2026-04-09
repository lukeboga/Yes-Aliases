import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	removeLinkUnderCursor,
	removeLinksInFile,
} from "../src/remove-driver";
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

describe("removeLinkUnderCursor", () => {
	it("strips matching alias in safe mode", () => {
		const content = "See [[jane|Jane]] today";
		const replaceRange = vi.fn();
		const editor = {
			getCursor: () => ({ line: 0, ch: 10 }),
			posToOffset: (p: any) => p.ch,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			getValue: () => content,
			replaceRange,
		} as any;
		const sourceFile = makeTFile("a.md");
		const targetFile = makeTFile("jane.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === sourceFile.path) {
						return {
							links: [
								{
									original: "[[jane|Jane]]",
									position: { start: { offset: 4 }, end: { offset: 17 } },
								},
							],
							sections: [],
						};
					}
					if (f.path === targetFile.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn(() => targetFile),
			},
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith", "Jane"]);

		const result = removeLinkUnderCursor(app, editor, sourceFile, makeSettings());
		expect(result.found).toBe(true);
		expect(replaceRange).toHaveBeenCalledWith(
			"[[jane]]",
			{ line: 0, ch: 4 },
			{ line: 0, ch: 17 },
		);
	});

	it("reports `found: false` when cursor is not on a link", () => {
		const editor = {
			getCursor: () => ({ line: 0, ch: 0 }),
			posToOffset: () => 0,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			getValue: () => "no link here",
			replaceRange: vi.fn(),
		} as any;
		const app = {
			metadataCache: { getFileCache: vi.fn(() => ({ links: [], sections: [] })) },
		} as any;
		const result = removeLinkUnderCursor(
			app,
			editor,
			makeTFile("a.md"),
			makeSettings(),
		);
		expect(result.found).toBe(false);
	});
});

describe("removeLinksInFile", () => {
	it("strips all matching aliases in a file (safe mode)", () => {
		const content = "A [[jane|Jane]] and [[bob|click here]]";
		const replaceRange = vi.fn();
		const editor = {
			getValue: () => content,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			replaceRange,
		} as any;
		const sourceFile = makeTFile("a.md");
		const janeFile = makeTFile("jane.md");
		const bobFile = makeTFile("bob.md");

		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === sourceFile.path) {
						return {
							links: [
								{
									original: "[[jane|Jane]]",
									position: { start: { offset: 2 }, end: { offset: 15 } },
								},
								{
									original: "[[bob|click here]]",
									position: { start: { offset: 20 }, end: { offset: 38 } },
								},
							],
							sections: [],
						};
					}
					if (f.path === janeFile.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					if (f.path === bobFile.path) {
						return { frontmatter: { aliases: ["Bob Jones"] } };
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn((linkpath: string) => {
					if (linkpath === "jane") return janeFile;
					if (linkpath === "bob") return bobFile;
					return null;
				}),
			},
		} as any;
		(parseFrontMatterAliases as any).mockImplementation((fm: any) => fm?.aliases ?? null);

		const stats = removeLinksInFile(app, editor, sourceFile, makeSettings());
		// "Jane" matches jane's aliases → stripped. "click here" does not match bob's → skipped.
		expect(stats.updated).toBe(1);
		expect(stats.skipped).toBe(1);
	});

	it("strips prose display text in aggressive mode", () => {
		const content = "A [[bob|click here]]";
		const editor = {
			getValue: () => content,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			replaceRange: vi.fn(),
		} as any;
		const sourceFile = makeTFile("a.md");
		const bobFile = makeTFile("bob.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === sourceFile.path) {
						return {
							links: [
								{
									original: "[[bob|click here]]",
									position: { start: { offset: 2 }, end: { offset: 20 } },
								},
							],
							sections: [],
						};
					}
					if (f.path === bobFile.path) {
						return { frontmatter: { aliases: ["Bob"] } };
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn(() => bobFile),
			},
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Bob"]);

		const stats = removeLinksInFile(
			app,
			editor,
			sourceFile,
			makeSettings({ removeIgnoresPropagationSafety: true }),
		);
		expect(stats.updated).toBe(1);
	});
});
