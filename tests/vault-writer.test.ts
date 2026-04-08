import { describe, expect, it } from "vitest";
import { applyFrontmatterRewrites, type FrontmatterRewrite } from "../src/vault-writer";

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
