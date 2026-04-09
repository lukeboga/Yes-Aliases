import { describe, expect, it, vi } from "vitest";
import {
	applyChangesInVault,
	applyFrontmatterRewrites,
	type FrontmatterRewrite,
} from "../src/vault-writer";
import type { PlannedChange } from "../src/editor-writer";

describe("applyFrontmatterRewrites", () => {
	it("replaces a single link in frontmatter", () => {
		const content = '---\ntype: "[[daily-note]]"\n---\n\nBody text.';
		const yamlEnd = content.indexOf("---", 3) + 3;
		const rewrites: FrontmatterRewrite[] = [
			{ original: "[[daily-note]]", newText: "[[daily-note|Daily Note]]" },
		];
		const result = applyFrontmatterRewrites(content, rewrites, 0, yamlEnd);
		expect(result.content).toBe('---\ntype: "[[daily-note|Daily Note]]"\n---\n\nBody text.');
		expect(result.applied).toBe(1);
	});

	it("replaces multiple different links", () => {
		const content = '---\na: "[[note-a]]"\nb: "[[note-b]]"\n---\n';
		const yamlEnd = content.lastIndexOf("---") + 3;
		const rewrites: FrontmatterRewrite[] = [
			{ original: "[[note-a]]", newText: "[[note-a|Alias A]]" },
			{ original: "[[note-b]]", newText: "[[note-b|Alias B]]" },
		];
		const result = applyFrontmatterRewrites(content, rewrites, 0, yamlEnd);
		expect(result.content).toBe('---\na: "[[note-a|Alias A]]"\nb: "[[note-b|Alias B]]"\n---\n');
		expect(result.applied).toBe(2);
	});

	it("deduplicates identical originals", () => {
		const content = '---\na: "[[dup]]"\nb: "[[dup]]"\n---\n';
		const yamlEnd = content.lastIndexOf("---") + 3;
		const rewrites: FrontmatterRewrite[] = [
			{ original: "[[dup]]", newText: "[[dup|Alias]]" },
			{ original: "[[dup]]", newText: "[[dup|Alias]]" },
		];
		const result = applyFrontmatterRewrites(content, rewrites, 0, yamlEnd);
		expect(result.content).toBe('---\na: "[[dup|Alias]]"\nb: "[[dup|Alias]]"\n---\n');
		expect(result.applied).toBe(2);
	});

	it("does not modify content outside YAML section", () => {
		const content = '---\nfoo: bar\n---\n\n[[daily-note]] in body';
		const yamlEnd = content.indexOf("---", 3) + 3;
		const rewrites: FrontmatterRewrite[] = [
			{ original: "[[daily-note]]", newText: "[[daily-note|DN]]" },
		];
		const result = applyFrontmatterRewrites(content, rewrites, 0, yamlEnd);
		expect(result.content).toBe(content);
		expect(result.applied).toBe(0);
	});

	it("returns unchanged content with empty rewrites", () => {
		const content = '---\nfoo: bar\n---\n';
		const result = applyFrontmatterRewrites(content, [], 0, 17);
		expect(result.content).toBe(content);
		expect(result.applied).toBe(0);
	});
});

describe("applyChangesInVault", () => {
	it("applies changes via vault.process and returns applied count", async () => {
		let processed = "";
		const app = {
			vault: {
				process: vi.fn(async (_file: any, mutator: (c: string) => string) => {
					processed = mutator("text [[a]] mid [[b]] end");
				}),
			},
		} as any;
		const changes: PlannedChange[] = [
			{ from: 5, to: 10, original: "[[a]]", newText: "[[a|A]]" },
			{ from: 15, to: 20, original: "[[b]]", newText: "[[b|B]]" },
		];
		const applied = await applyChangesInVault(app, { path: "x.md" } as any, changes);
		expect(applied).toBe(2);
		expect(processed).toBe("text [[a|A]] mid [[b|B]] end");
	});

	it("skips mismatched originals", async () => {
		let processed = "";
		const app = {
			vault: {
				process: vi.fn(async (_file: any, mutator: (c: string) => string) => {
					processed = mutator("text [[a]] end");
				}),
			},
		} as any;
		const changes: PlannedChange[] = [
			{ from: 5, to: 10, original: "[[WRONG]]", newText: "[[x|X]]" },
		];
		const applied = await applyChangesInVault(app, { path: "x.md" } as any, changes);
		expect(applied).toBe(0);
		expect(processed).toBe("text [[a]] end");
	});

	it("returns 0 for empty change list without calling vault.process", async () => {
		const app = { vault: { process: vi.fn() } } as any;
		expect(await applyChangesInVault(app, { path: "x.md" } as any, [])).toBe(0);
		expect(app.vault.process).not.toHaveBeenCalled();
	});
});
