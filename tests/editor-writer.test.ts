import { describe, expect, it, vi } from "vitest";
import {
	applyChangesInEditor,
	skipReasonMessage,
	updateLinksInFile,
	type PlannedChange,
} from "../src/editor-writer";
import { parseFrontMatterAliases, TFile } from "obsidian";
import type { YesAliasesSettings } from "../src/settings";

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

describe("updateLinksInFile", () => {
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

		const stats = await updateLinksInFile(
			app,
			editor,
			sourceFile,
			makeSettings({ overwriteExisting: true }),
		);

		expect(app.vault.process).toHaveBeenCalled();
		expect(replaceRange).not.toHaveBeenCalled();
		expect(stats.updated).toBe(2);
		expect(processed).toBe(
			'---\nrelated: "[[jane|Jane Smith]]"\n---\n\nA [[jane|Jane Smith]] x',
		);
	});
});
