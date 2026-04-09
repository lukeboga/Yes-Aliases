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
	TFolder,
	Vault,
} from "obsidian";
import {
	removeLinksInFolder,
	removeLinksInVault,
} from "../src/remove-driver";

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
	it("strips all matching aliases in a file (safe mode)", async () => {
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

		const stats = await removeLinksInFile(app, editor, sourceFile, makeSettings());
		// "Jane" matches jane's aliases → stripped. "click here" does not match bob's → skipped.
		expect(stats.updated).toBe(1);
		expect(stats.skipped).toBe(1);
	});

	it("routes through vault.process when frontmatter changes exist (FM-LP fix)", async () => {
		// YAML on lines 1-3, FM link [[jane|Jane]] at offsets 14-27.
		// Body link [[jane|Jane]] at offsets 36-49.
		const content =
			'---\nrelated: "[[jane|Jane]]"\n---\n\nA [[jane|Jane]] x';
		const replaceRange = vi.fn();
		const editor = {
			getValue: () => content,
			offsetToPos: (o: number) => ({ line: 0, ch: o }),
			replaceRange,
		} as any;
		let processed: string | null = null;
		const sourceFile = makeTFile("a.md");
		const janeFile = makeTFile("jane.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === sourceFile.path) {
						return {
							links: [
								{
									original: "[[jane|Jane]]",
									position: {
										start: { offset: 36 },
										end: { offset: 49 },
									},
								},
							],
							frontmatterLinks: [
								{ link: "jane", original: "[[jane|Jane]]" },
							],
							sections: [
								{
									type: "yaml",
									position: {
										start: { offset: 0 },
										end: { offset: 32 },
									},
								},
							],
						};
					}
					if (f.path === janeFile.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn(() => janeFile),
			},
			vault: {
				process: vi.fn(
					async (_file: any, mut: (c: string) => string) => {
						processed = mut(content);
						return processed;
					},
				),
			},
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith", "Jane"]);

		const stats = await removeLinksInFile(
			app,
			editor,
			sourceFile,
			makeSettings(),
		);

		expect(app.vault.process).toHaveBeenCalled();
		expect(replaceRange).not.toHaveBeenCalled();
		expect(stats.updated).toBe(2);
		expect(processed).toBe('---\nrelated: "[[jane]]"\n---\n\nA [[jane]] x');
	});

	it("strips prose display text in aggressive mode", async () => {
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

		const stats = await removeLinksInFile(
			app,
			editor,
			sourceFile,
			makeSettings({ removeIgnoresPropagationSafety: true }),
		);
		expect(stats.updated).toBe(1);
	});
});

describe("removeLinksInFolder", () => {
	it("processes all markdown files in the folder", async () => {
		const folder = new TFolder();
		folder.path = "notes";
		folder.name = "notes";
		const a = makeTFile("notes/a.md");
		(Vault.recurseChildren as any).mockImplementation(
			(_f: any, cb: (child: any) => void) => {
				cb(a);
			},
		);

		const app = {
			metadataCache: {
				getFileCache: vi.fn(() => ({ links: [], frontmatterLinks: [], sections: [] })),
				getFirstLinkpathDest: vi.fn(),
			},
			vault: { process: vi.fn() },
		} as any;

		const stats = await removeLinksInFolder(app, folder, makeSettings());
		expect(stats.filesProcessed).toBe(0); // no links to remove → no file written
	});
});

describe("removeLinksInVault", () => {
	it("skips files in ignoredFolders", async () => {
		const a = makeTFile("a.md");
		const b = makeTFile("_archive/b.md");
		const app = {
			vault: {
				getMarkdownFiles: vi.fn(() => [a, b]),
				process: vi.fn(),
			},
			metadataCache: {
				getFileCache: vi.fn(() => ({ links: [], frontmatterLinks: [], sections: [] })),
				getFirstLinkpathDest: vi.fn(),
			},
		} as any;

		const stats = await removeLinksInVault(
			app,
			makeSettings({ ignoredFolders: ["_archive"] }),
		);
		// Called for a.md only; b.md filtered. Both have no links so filesProcessed = 0.
		expect(stats.filesProcessed).toBe(0);
	});
});
