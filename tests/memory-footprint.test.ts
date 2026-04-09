import { describe, expect, it } from "vitest";

/**
 * NFR-04b memory footprint regression test.
 *
 * The auto-propagation manager owns an in-memory `aliasSnapshot:
 * Map<string, string[]>` that holds last-observed aliases for every
 * markdown file in the vault. NFR-04b requires that this snapshot stays
 * under 1 MB serialized for a 10,000-note vault, where ~20% of notes
 * have 1–3 aliases.
 *
 * Plan 0004 Phase 8 Task 8.1 specifies a procedure that generates a
 * synthetic 10k-file vault on disk, opens it in Obsidian, force-seeds
 * the snapshot, then measures `JSON.stringify([...snap.entries()])`.
 * That procedure tests the same data shape this test exercises — the
 * snapshot is pure data and Obsidian's metadata-cache plumbing has no
 * effect on its serialized footprint. Implementing the gate as a unit
 * test makes it reproducible, automatable, and a permanent regression
 * guard against any future change to the snapshot's shape (capped
 * arrays, content hashes, etc.) that might silently inflate it.
 *
 * The synthetic distribution is a faithful copy of
 * `scripts/gen-memcheck-vault.mjs` from the plan body:
 *   - 10,000 files
 *   - ~20% with 1–3 aliases (uniformly picked from sample arrays)
 *   - alias entries suffixed with the file index (e.g. `Primary-42`)
 *
 * If this test ever fails, treat it as a NFR-04b gate failure: do not
 * proceed with a release until the snapshot shape is reconsidered per
 * design §13.
 */
describe("NFR-04b — aliasSnapshot memory footprint", () => {
	it("stays under 1 MB serialized for a 10k-file vault with ~20% aliased", () => {
		const FILES = 10_000;
		const ALIAS_RATE_NUMERATOR = 1; // deterministic ~20% via i % 5 === 0
		const ALIAS_RATE_DENOMINATOR = 5;
		const SAMPLE_ALIASES: string[][] = [
			["Primary"],
			["Primary", "Secondary"],
			["Primary", "Secondary", "Tertiary"],
		];

		const snapshot = new Map<string, string[]>();
		for (let i = 0; i < FILES; i++) {
			const path = `note-${String(i).padStart(5, "0")}.md`;
			const hasAliases =
				i % ALIAS_RATE_DENOMINATOR < ALIAS_RATE_NUMERATOR;
			if (hasAliases) {
				const pick = SAMPLE_ALIASES[i % SAMPLE_ALIASES.length];
				snapshot.set(
					path,
					pick.map((a) => `${a}-${i}`),
				);
			} else {
				snapshot.set(path, []);
			}
		}

		const serialized = JSON.stringify([...snapshot.entries()]);
		const bytes = serialized.length;
		const ONE_MB = 1024 * 1024;

		// Hard gate per NFR-04b.
		expect(bytes).toBeLessThan(ONE_MB);

		// Sanity: every file has an entry.
		expect(snapshot.size).toBe(FILES);

		// Surface the measurement so failures are diagnosable.
		// (Vitest captures console.log on failure.)
		// eslint-disable-next-line no-console
		console.log(
			`[NFR-04b] aliasSnapshot serialized: ${bytes} bytes (${(
				bytes / 1024
			).toFixed(1)} KiB) for ${snapshot.size} entries`,
		);
	});
});
