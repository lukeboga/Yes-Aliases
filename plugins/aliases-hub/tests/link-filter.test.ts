import { describe, expect, it } from "vitest";
import {
	isInsideSection,
	isInsideInlineCode,
	isEmbed,
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
