import { describe, expect, it } from "vitest";
import {
	isInsideSection,
	isInsideInlineCode,
	isEmbed,
	getYamlSectionRange,
	findFrontmatterLinkOffset,
	getLinkpathFromFrontmatterLink,
	toLinkInput,
	type OffsetRange,
} from "../src/link-filter";

describe("isInsideSection", () => {
	const sections: OffsetRange[] = [
		{ start: 0, end: 50 },
		{ start: 200, end: 300 },
	];

	it("returns true when link is inside a section range", () => {
		expect(isInsideSection(10, 30, sections)).toBe(true);
	});

	it("returns true when link overlaps section boundary", () => {
		expect(isInsideSection(195, 210, sections)).toBe(true);
	});

	it("returns false when link is outside all section ranges", () => {
		expect(isInsideSection(100, 150, sections)).toBe(false);
	});

	it("returns false with empty sections", () => {
		expect(isInsideSection(10, 20, [])).toBe(false);
	});
});

describe("isInsideInlineCode", () => {
	it("detects link inside single backticks", () => {
		const content = "some text `[[link]]` more text";
		const linkStart = 11;
		const linkEnd = 19;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(true);
	});

	it("returns false when link is not in backticks", () => {
		const content = "some text [[link]] more text";
		const linkStart = 10;
		const linkEnd = 18;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(false);
	});

	it("returns false when backticks are on different lines", () => {
		const content = "text `code\n[[link]]` more";
		const linkStart = 11;
		const linkEnd = 19;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(false);
	});

	it("handles double backtick delimiters", () => {
		const content = "text ``[[link]]`` more";
		const linkStart = 7;
		const linkEnd = 15;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(true);
	});

	it("returns false when backtick is inside the link", () => {
		const content = "text [[li`nk]] more";
		const linkStart = 5;
		const linkEnd = 14;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(false);
	});

	it("detects link inside backticks with surrounding text", () => {
		const content = "text `some text [[link]] more text` end";
		const linkStart = 17;
		const linkEnd = 25;
		expect(isInsideInlineCode(content, linkStart, linkEnd)).toBe(true);
	});
});

describe("isEmbed", () => {
	it("returns true when preceded by !", () => {
		const content = "text ![[file]] more";
		expect(isEmbed(content, 6)).toBe(true);
	});

	it("returns false for normal wikilink", () => {
		const content = "text [[file]] more";
		expect(isEmbed(content, 5)).toBe(false);
	});

	it("returns false at start of content", () => {
		const content = "[[file]] more";
		expect(isEmbed(content, 0)).toBe(false);
	});
});

describe("toLinkInput with frontmatter-shaped input", () => {
	const settings = { overwriteExisting: false, updateFrontmatterLinks: true, ignoredFolders: [] };

	it("handles a bare frontmatter link", () => {
		const link = { original: "[[target-file]]", link: "target-file", displayText: "target-file", key: "ntags.0" };
		const result = toLinkInput(link, "My Alias", settings);
		expect(result).toEqual({
			original: "[[target-file]]",
			hasExplicitDisplayText: false,
			currentDisplayText: null,
			targetAlias: "My Alias",
			overwriteExisting: false,
		});
	});

	it("handles a frontmatter link with display text", () => {
		const link = { original: "[[target-file|Old Text]]", link: "target-file", displayText: "Old Text", key: "type" };
		const result = toLinkInput(link, "My Alias", settings);
		expect(result).toEqual({
			original: "[[target-file|Old Text]]",
			hasExplicitDisplayText: true,
			currentDisplayText: "Old Text",
			targetAlias: "My Alias",
			overwriteExisting: false,
		});
	});

	it("handles a frontmatter link with subpath", () => {
		const link = { original: "[[target-file#heading]]", link: "target-file#heading", displayText: "target-file > heading", key: "ref" };
		const result = toLinkInput(link, "My Alias", settings);
		expect(result).toEqual({
			original: "[[target-file#heading]]",
			hasExplicitDisplayText: false,
			currentDisplayText: null,
			targetAlias: "My Alias",
			overwriteExisting: false,
		});
	});
});

describe("getYamlSectionRange", () => {
	it("returns the yaml section range", () => {
		const sections = [
			{ type: "yaml", position: { start: { offset: 0 }, end: { offset: 100 } } },
			{ type: "paragraph", position: { start: { offset: 101 }, end: { offset: 200 } } },
		] as any;
		expect(getYamlSectionRange(sections)).toEqual({ start: 0, end: 100 });
	});

	it("returns null when no yaml section exists", () => {
		const sections = [
			{ type: "paragraph", position: { start: { offset: 0 }, end: { offset: 100 } } },
		] as any;
		expect(getYamlSectionRange(sections)).toBeNull();
	});

	it("returns null when sections is undefined", () => {
		expect(getYamlSectionRange(undefined)).toBeNull();
	});
});

describe("findFrontmatterLinkOffset", () => {
	const content = '---\nntags:\n  - "[[target-note]]"\ntype: "[[other-note|Display]]"\n---\n\nBody text here.';
	const yamlStart = 0;
	const yamlEnd = content.indexOf("---", 3) + 3;

	it("finds a bare link in frontmatter", () => {
		const result = findFrontmatterLinkOffset(content, "[[target-note]]", yamlStart, yamlEnd);
		expect(result).not.toBeNull();
		expect(content.slice(result!.start, result!.end)).toBe("[[target-note]]");
	});

	it("finds a link with display text in frontmatter", () => {
		const result = findFrontmatterLinkOffset(content, "[[other-note|Display]]", yamlStart, yamlEnd);
		expect(result).not.toBeNull();
		expect(content.slice(result!.start, result!.end)).toBe("[[other-note|Display]]");
	});

	it("returns null when link is not in frontmatter", () => {
		const result = findFrontmatterLinkOffset(content, "[[nonexistent]]", yamlStart, yamlEnd);
		expect(result).toBeNull();
	});

	it("returns null when link exists only outside YAML bounds", () => {
		const contentWithBody = '---\nfoo: bar\n---\n\n[[target-note]] in body';
		const end = contentWithBody.indexOf("---", 3) + 3;
		const result = findFrontmatterLinkOffset(contentWithBody, "[[target-note]]", 0, end);
		expect(result).toBeNull();
	});

	it("finds the first occurrence when link appears multiple times", () => {
		const content2 = '---\na: "[[dup]]"\nb: "[[dup]]"\n---\n';
		const end2 = content2.lastIndexOf("---") + 3;
		const result = findFrontmatterLinkOffset(content2, "[[dup]]", 0, end2);
		expect(result).not.toBeNull();
		expect(result!.start).toBe(content2.indexOf("[[dup]]"));
	});
});

describe("getLinkpathFromFrontmatterLink", () => {
	it("returns the link as-is when no hash", () => {
		expect(getLinkpathFromFrontmatterLink({ link: "notes/my-note" })).toBe("notes/my-note");
	});

	it("strips the hash and subpath", () => {
		expect(getLinkpathFromFrontmatterLink({ link: "notes/my-note#heading" })).toBe("notes/my-note");
	});

	it("strips block reference subpath", () => {
		expect(getLinkpathFromFrontmatterLink({ link: "notes/my-note#^block-id" })).toBe("notes/my-note");
	});
});
