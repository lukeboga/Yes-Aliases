import type { LinkCache, SectionCache } from "obsidian";
import { extractLinkPath, type LinkInput } from "./pipeline";
import type { AliasHubSettings } from "./settings";

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
 * Scans backward from linkStart for an opening backtick sequence and forward
 * from linkEnd for a matching closing sequence, both on the same line.
 */
export function isInsideInlineCode(
	content: string,
	linkStart: number,
	linkEnd: number,
): boolean {
	const lineStart = content.lastIndexOf("\n", linkStart - 1) + 1;
	const lineEnd = content.indexOf("\n", linkEnd);
	const effectiveLineEnd = lineEnd === -1 ? content.length : lineEnd;

	const before = content.slice(lineStart, linkStart);
	const after = content.slice(linkEnd, effectiveLineEnd);

	const openMatch = before.match(/(`+)$/);
	if (!openMatch) return false;

	const backtickLen = openMatch[1]!.length;
	const closePattern = new RegExp(`^\`{${backtickLen}}`);
	return closePattern.test(after);
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
	settings: AliasHubSettings,
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
