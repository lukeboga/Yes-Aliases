import type { LinkCache, SectionCache } from "obsidian";
import { extractLinkPath, type LinkInput } from "./pipeline";
import type { YesAliasesSettings } from "./settings";

/** A start/end offset range for position comparison. */
export interface OffsetRange {
	start: number;
	end: number;
}

/** Check whether a link (by its start/end offsets) overlaps any excluded section range. */
export function isInsideSection(
	linkStart: number,
	linkEnd: number,
	excludedSections: OffsetRange[],
): boolean {
	for (const section of excludedSections) {
		if (linkStart < section.end && linkEnd > section.start) {
			return true;
		}
	}
	return false;
}

/**
 * Check whether a link at the given offsets sits inside an inline code span.
 * Walks the line to find all backtick-delimited code spans and checks if
 * the link falls inside any of them.
 */
export function isInsideInlineCode(
	content: string,
	linkStart: number,
	linkEnd: number,
): boolean {
	const lineStart = content.lastIndexOf("\n", linkStart - 1) + 1;
	const lineEnd = content.indexOf("\n", linkEnd);
	const effectiveLineEnd = lineEnd === -1 ? content.length : lineEnd;
	const line = content.slice(lineStart, effectiveLineEnd);

	const linkRelStart = linkStart - lineStart;
	const linkRelEnd = linkEnd - lineStart;

	let i = 0;
	while (i < line.length) {
		if (line[i] !== "`") {
			i++;
			continue;
		}

		// Count opening backticks
		let backtickLen = 0;
		while (i + backtickLen < line.length && line[i + backtickLen] === "`") {
			backtickLen++;
		}

		const spanStart = i + backtickLen;
		i = spanStart;

		// Find matching closing backticks of same length
		const closingPattern = "`".repeat(backtickLen);
		const closeIndex = line.indexOf(closingPattern, i);
		if (closeIndex === -1) break; // Unclosed — no more spans on this line

		const spanEnd = closeIndex;

		// Check if link overlaps this code span
		if (linkRelStart >= spanStart && linkRelEnd <= spanEnd) {
			return true;
		}

		i = closeIndex + backtickLen;
	}

	return false;
}

/**
 * Check whether the link at the given start offset is an embed (![[...]]).
 * @param linkStartOffset - The offset of the first `[` in `[[`.
 */
export function isEmbed(content: string, linkStartOffset: number): boolean {
	return linkStartOffset > 0 && content[linkStartOffset - 1] === "!";
}

/**
 * Build the list of excluded section offset ranges (yaml and code)
 * from cached section metadata.
 */
export function buildExcludedRanges(
	sections: SectionCache[] | undefined,
): OffsetRange[] {
	if (!sections) return [];
	const excluded: OffsetRange[] = [];
	for (const section of sections) {
		if (section.type === "yaml" || section.type === "code") {
			excluded.push({
				start: section.position.start.offset,
				end: section.position.end.offset,
			});
		}
	}
	return excluded;
}

/** Extract the linkpath portion (without subpath) from a link for resolution. */
export function getLinkpathForResolution(link: LinkCache): string {
	const full = extractLinkPath(link.original);
	const hashIndex = full.indexOf("#");
	return hashIndex === -1 ? full : full.slice(0, hashIndex);
}

/**
 * Parse a LinkCache entry into a LinkInput for the pipeline.
 * Uses the link's `original` field to determine explicit display text.
 */
export function toLinkInput(
	link: LinkCache,
	alias: string | null,
	settings: YesAliasesSettings,
): LinkInput {
	const pipeIndex = link.original.indexOf("|");
	const hasExplicit = pipeIndex !== -1;
	const currentDisplayText = hasExplicit
		? link.original.slice(pipeIndex + 1, -2)
		: null;

	return {
		original: link.original,
		hasExplicitDisplayText: hasExplicit,
		currentDisplayText,
		targetAlias: alias,
		overwriteExisting: settings.overwriteExisting,
	};
}

/**
 * Determine whether a link should be skipped based on its position
 * (inside excluded sections, inline code, or embed syntax).
 */
export function isLinkExcluded(
	link: LinkCache,
	content: string,
	excludedRanges: OffsetRange[],
): boolean {
	const startOffset = link.position.start.offset;
	const endOffset = link.position.end.offset;

	if (isInsideSection(startOffset, endOffset, excludedRanges)) return true;
	if (isInsideInlineCode(content, startOffset, endOffset)) return true;
	if (isEmbed(content, startOffset)) return true;

	return false;
}
