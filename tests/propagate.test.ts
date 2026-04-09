import { describe, expect, it, vi, beforeEach } from "vitest";
import {
	propagateFile,
	propagateFolder,
	propagateVault,
	type PropagateStats,
} from "../src/propagate";
import type { YesAliasesSettings } from "../src/settings";
import {
	parseFrontMatterAliases,
	parseFrontMatterStringArray,
	TFile,
	TFolder,
	Vault,
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

describe("propagateFile", () => {
	it("rewrites a historical-alias backlink in a closed source file", async () => {
		const targetFile = makeTFile("people/jane.md");
		const sourceFile = makeTFile("notes/a.md");
		const sourceContent = "See [[people/jane|Jane]] today.";
		let writtenContent = sourceContent;

		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === targetFile.path) {
						return { frontmatter: { aliases: ["Jane Smith", "Jane"] } };
					}
					if (f.path === sourceFile.path) {
						return {
							links: [
								{
									original: "[[people/jane|Jane]]",
									position: { start: { offset: 4 }, end: { offset: 24 } },
								},
							],
							sections: [],
						};
					}
					return null;
				}),
				getFirstLinkpathDest: vi.fn((linkpath: string) => {
					if (linkpath === "people/jane") return targetFile;
					return null;
				}),
				resolvedLinks: {
					"notes/a.md": { "people/jane.md": 1 },
				},
			},
			vault: {
				getAbstractFileByPath: vi.fn((p: string) => {
					if (p === sourceFile.path) return sourceFile;
					return null;
				}),
				process: vi.fn(async (_file: any, mutator: (c: string) => string) => {
					writtenContent = mutator(sourceContent);
				}),
			},
			workspace: { getActiveFile: vi.fn(), iterateAllLeaves: vi.fn(() => {}) },
		} as any;

		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith", "Jane"]);

		const stats: PropagateStats = await propagateFile(app, targetFile, makeSettings(), {
			source: "manual",
		});

		expect(stats.linksRewritten).toBe(1);
		expect(stats.filesTouched).toBe(1);
		expect(writtenContent).toBe("See [[people/jane|Jane Smith]] today.");
	});

	it("is a no-op when target has no canonical alias", async () => {
		const targetFile = makeTFile("x.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn(() => ({ frontmatter: {} })),
				getFirstLinkpathDest: vi.fn(),
				resolvedLinks: {},
			},
			vault: { getAbstractFileByPath: vi.fn(), process: vi.fn() },
			workspace: { iterateAllLeaves: vi.fn(() => {}) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(null);
		(parseFrontMatterStringArray as any).mockReturnValue(null);

		const stats = await propagateFile(app, targetFile, makeSettings(), { source: "manual" });
		expect(stats.linksRewritten).toBe(0);
		expect(stats.filesTouched).toBe(0);
	});

	it("skips source files in ignoredFolders", async () => {
		const targetFile = makeTFile("people/jane.md");
		const ignoredSource = makeTFile("_archive/old.md");
		const app = {
			metadataCache: {
				getFileCache: vi.fn((f: any) => {
					if (f.path === targetFile.path) {
						return { frontmatter: { aliases: ["Jane Smith"] } };
					}
					return { links: [], sections: [] };
				}),
				getFirstLinkpathDest: vi.fn(() => targetFile),
				resolvedLinks: { "_archive/old.md": { "people/jane.md": 1 } },
			},
			vault: {
				getAbstractFileByPath: vi.fn(() => ignoredSource),
				process: vi.fn(),
			},
			workspace: { iterateAllLeaves: vi.fn(() => {}) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(["Jane Smith"]);

		const stats = await propagateFile(
			app,
			targetFile,
			makeSettings({ ignoredFolders: ["_archive"] }),
			{ source: "manual" },
		);
		expect(stats.linksRewritten).toBe(0);
		expect(app.vault.process).not.toHaveBeenCalled();
	});
});

describe("propagateFolder", () => {
	it("propagates each markdown file in the folder as a target", async () => {
		const folder = new TFolder();
		folder.path = "people";
		folder.name = "people";
		const jane = makeTFile("people/jane.md");
		const john = makeTFile("people/john.md");

		(Vault.recurseChildren as any).mockImplementation(
			(_f: any, cb: (child: any) => void) => {
				cb(jane);
				cb(john);
			},
		);

		const app = {
			metadataCache: {
				getFileCache: vi.fn(() => ({ frontmatter: {} })),
				getFirstLinkpathDest: vi.fn(),
				resolvedLinks: {},
			},
			vault: { getAbstractFileByPath: vi.fn(), process: vi.fn() },
			workspace: { iterateAllLeaves: vi.fn(() => {}) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(null);
		(parseFrontMatterStringArray as any).mockReturnValue(null);

		const stats = await propagateFolder(app, folder, makeSettings(), {
			source: "manual",
		});
		expect(stats.targetsProcessed).toBe(2);
		expect(stats.linksRewritten).toBe(0);
	});

	it("skips non-markdown children", async () => {
		const folder = new TFolder();
		folder.path = "mixed";
		const note = makeTFile("mixed/a.md");
		const image = makeTFile("mixed/img.png", "png");

		(Vault.recurseChildren as any).mockImplementation(
			(_f: any, cb: (child: any) => void) => {
				cb(note);
				cb(image);
			},
		);

		const app = {
			metadataCache: {
				getFileCache: vi.fn(() => ({ frontmatter: {} })),
				getFirstLinkpathDest: vi.fn(),
				resolvedLinks: {},
			},
			vault: { getAbstractFileByPath: vi.fn(), process: vi.fn() },
			workspace: { iterateAllLeaves: vi.fn(() => {}) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(null);
		(parseFrontMatterStringArray as any).mockReturnValue(null);

		const stats = await propagateFolder(app, folder, makeSettings(), {
			source: "manual",
		});
		expect(stats.targetsProcessed).toBe(1);
	});
});

describe("propagateVault", () => {
	it("iterates every markdown file and skips targets in ignoredFolders", async () => {
		const a = makeTFile("a.md");
		const b = makeTFile("_archive/b.md");
		const c = makeTFile("c.md");

		const app = {
			vault: {
				getMarkdownFiles: vi.fn(() => [a, b, c]),
				getAbstractFileByPath: vi.fn(),
				process: vi.fn(),
			},
			metadataCache: {
				getFileCache: vi.fn(() => ({ frontmatter: {} })),
				getFirstLinkpathDest: vi.fn(),
				resolvedLinks: {},
			},
			workspace: { iterateAllLeaves: vi.fn(() => {}) },
		} as any;
		(parseFrontMatterAliases as any).mockReturnValue(null);
		(parseFrontMatterStringArray as any).mockReturnValue(null);

		const stats = await propagateVault(
			app,
			makeSettings({ ignoredFolders: ["_archive"] }),
			{ source: "manual" },
		);
		// b.md is in _archive and is skipped as a target per §15.4.
		expect(stats.targetsProcessed).toBe(2);
	});
});
