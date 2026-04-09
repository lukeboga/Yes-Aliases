import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TFile, parseFrontMatterAliases } from "obsidian";
import {
	AutoPropagationManager,
	type AutoPropagationHost,
} from "../src/auto-propagate";
import type { YesAliasesSettings } from "../src/settings";

/** Build a TFile-instance test fixture so `instanceof TFile` checks pass under the mock. */
function makeTFile(path: string, extension = "md"): TFile {
	const f = new TFile();
	f.path = path;
	f.extension = extension;
	return f;
}

function makeSettings(
	partial: Partial<YesAliasesSettings> = {},
): YesAliasesSettings {
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

interface MockHost extends AutoPropagationHost {
	registerEvent: ReturnType<typeof vi.fn>;
	registerInterval: ReturnType<typeof vi.fn>;
	propagate: ReturnType<typeof vi.fn>;
}

function makePlugin(settings: YesAliasesSettings): {
	plugin: MockHost;
	registerEvent: ReturnType<typeof vi.fn>;
	registerInterval: ReturnType<typeof vi.fn>;
} {
	const registerEvent = vi.fn();
	const registerInterval = vi.fn();
	const app = {
		vault: { on: vi.fn(() => ({})) },
		metadataCache: {
			on: vi.fn(() => ({})),
			getFileCache: vi.fn(() => null),
		},
	} as any;
	const plugin: MockHost = {
		app,
		settings,
		registerEvent,
		registerInterval,
		propagate: vi.fn(),
	};
	return { plugin, registerEvent, registerInterval };
}

beforeEach(() => {
	vi.useFakeTimers();
	(parseFrontMatterAliases as any).mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("AutoPropagationManager lifecycle", () => {
	it("start() registers vault + metadataCache events and the 60s interval", () => {
		const { plugin, registerEvent, registerInterval } = makePlugin(
			makeSettings(),
		);
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		// 4 events: vault create, delete, rename, metadataCache changed.
		expect(registerEvent).toHaveBeenCalledTimes(4);
		expect(registerInterval).toHaveBeenCalledTimes(1);
	});

	it("stop() clears all internal maps and debounce timers", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		mgr.recordWrite("a.md");
		mgr.stop();
		expect(mgr.debugSize()).toEqual({
			aliasSnapshot: 0,
			recentlyCreated: 0,
			inFlightWrites: 0,
			debounceTimers: 0,
		});
	});
});

describe("AutoPropagationManager vault events", () => {
	it("onCreate seeds recentlyCreated with a 30-min expiry", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("new.md");
		(mgr as any).onCreate(file);
		expect(mgr.debugSize().recentlyCreated).toBe(1);
	});

	it("onCreate ignores non-markdown files", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("image.png", "png");
		(mgr as any).onCreate(file);
		expect(mgr.debugSize().recentlyCreated).toBe(0);
	});

	it("onDelete removes entries from all maps", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onCreate(file);
		mgr.recordWrite("a.md");
		(mgr as any).onDelete(file);
		const size = mgr.debugSize();
		expect(size.recentlyCreated).toBe(0);
		expect(size.inFlightWrites).toBe(0);
	});

	it("onRename re-keys all maps from old path to new path", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		mgr.recordWrite("old.md");
		const renamed = makeTFile("new.md");
		(mgr as any).onRename(renamed, "old.md");
		const size = mgr.debugSize();
		expect(size.inFlightWrites).toBe(1);
		// recordWrite on the new path should not duplicate.
		mgr.recordWrite("new.md");
		expect(mgr.debugSize().inFlightWrites).toBe(1);
	});
});

describe("onChanged — lazy seed", () => {
	it("first observation seeds the snapshot without propagating", () => {
		const { plugin } = makePlugin(makeSettings());
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["Jane"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["Jane"]);

		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("jane.md");
		(mgr as any).onChanged(file);

		// Drive the 500ms debounce.
		vi.advanceTimersByTime(500);

		expect(plugin.propagate).not.toHaveBeenCalled();
		expect(mgr.debugSize().aliasSnapshot).toBe(1);
	});

	it("first observation of a recently-created file propagates (new-note branch)", () => {
		const { plugin } = makePlugin(makeSettings());
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["Q1 review"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["Q1 review"]);

		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("20240315-mtg.md");
		(mgr as any).onCreate(file);
		(mgr as any).onChanged(file);

		vi.advanceTimersByTime(500);

		expect(plugin.propagate).toHaveBeenCalledTimes(1);
		expect(plugin.propagate).toHaveBeenCalledWith(file, "auto");
		expect(mgr.debugSize().recentlyCreated).toBe(0);
	});

	it("does not propagate when autoPropagateNewNoteAliases is false", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPropagateNewNoteAliases: false }),
		);
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["X"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["X"]);

		const mgr = new AutoPropagationManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onCreate(file);
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		expect(plugin.propagate).not.toHaveBeenCalled();
	});
});
