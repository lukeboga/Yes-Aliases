import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TFile, parseFrontMatterAliases } from "obsidian";
import {
	AutoPushManager,
	type AutoPushHost,
} from "../src/auto-push";
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
		autoPushNewNoteAliases: true,
		autoPushAllAliasChanges: false,
		autoPushNoticeThreshold: 5,
		aliasesKeepCount: 1,
		compressWarnInsteadOfBlock: false,
		removeIgnoresPushSafety: false,
		...partial,
	};
}

interface MockHost extends AutoPushHost {
	registerEvent: ReturnType<typeof vi.fn>;
	registerInterval: ReturnType<typeof vi.fn>;
	push: ReturnType<typeof vi.fn>;
}

function makePlugin(settings: YesAliasesSettings): {
	plugin: MockHost;
	registerEvent: ReturnType<typeof vi.fn>;
	registerInterval: ReturnType<typeof vi.fn>;
	triggerLayoutReady: () => void;
} {
	const registerEvent = vi.fn();
	const registerInterval = vi.fn();
	let layoutReadyCb: (() => void) | null = null;
	const app = {
		vault: { on: vi.fn(() => ({})) },
		metadataCache: {
			on: vi.fn(() => ({})),
			getFileCache: vi.fn(() => null),
		},
		workspace: {
			onLayoutReady: vi.fn((cb: () => void) => {
				layoutReadyCb = cb;
			}),
		},
	} as any;
	const plugin: MockHost = {
		app,
		settings,
		registerEvent,
		registerInterval,
		push: vi.fn(),
	};
	const triggerLayoutReady = () => {
		if (layoutReadyCb) layoutReadyCb();
	};
	return { plugin, registerEvent, registerInterval, triggerLayoutReady };
}

beforeEach(() => {
	vi.useFakeTimers();
	(parseFrontMatterAliases as any).mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("AutoPushManager lifecycle", () => {
	it("start() registers vault + metadataCache events and the 60s interval", () => {
		const { plugin, registerEvent, registerInterval, triggerLayoutReady } =
			makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
		mgr.start();
		// 3 immediate events: vault delete, rename, metadataCache changed.
		// vault create is deferred until layout-ready.
		expect(registerEvent).toHaveBeenCalledTimes(3);
		expect(registerInterval).toHaveBeenCalledTimes(1);
		triggerLayoutReady();
		// After layout-ready: vault create is now registered.
		expect(registerEvent).toHaveBeenCalledTimes(4);
	});

	it("start() defers vault create registration until layout-ready to avoid initial-index pollution", () => {
		const { plugin, triggerLayoutReady } = makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
		mgr.start();

		// Before layout-ready: onCreate should not be wired up.
		// Directly calling onCreate to simulate what would happen if
		// vault.on('create') fired during initial index scan.
		const file = makeTFile("existing.md");
		(mgr as any).onCreate(file);
		// onCreate itself still adds to recentlyCreated — the protection
		// is that the event listener isn't registered yet, so Obsidian's
		// initial-index create events never reach onCreate.
		// We verify the event registration count instead.
		expect(plugin.app.vault.on).not.toHaveBeenCalledWith(
			"create",
			expect.any(Function),
		);

		triggerLayoutReady();
		expect(plugin.app.vault.on).toHaveBeenCalledWith(
			"create",
			expect.any(Function),
		);
	});

	it("stop() clears all internal maps and debounce timers", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
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

describe("AutoPushManager vault events", () => {
	it("onCreate seeds recentlyCreated with a 30-min expiry", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("new.md");
		(mgr as any).onCreate(file);
		expect(mgr.debugSize().recentlyCreated).toBe(1);
	});

	it("onCreate ignores non-markdown files", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("image.png", "png");
		(mgr as any).onCreate(file);
		expect(mgr.debugSize().recentlyCreated).toBe(0);
	});

	it("onDelete removes entries from all maps", () => {
		const { plugin } = makePlugin(makeSettings());
		const mgr = new AutoPushManager(plugin);
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
		const mgr = new AutoPushManager(plugin);
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
	it("first observation seeds the snapshot without pushing", () => {
		const { plugin } = makePlugin(makeSettings());
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["Jane"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["Jane"]);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("jane.md");
		(mgr as any).onChanged(file);

		// Drive the 500ms debounce.
		vi.advanceTimersByTime(500);

		expect(plugin.push).not.toHaveBeenCalled();
		expect(mgr.debugSize().aliasSnapshot).toBe(1);
	});

	it("first observation of a recently-created file pushes (new-note branch)", () => {
		const { plugin } = makePlugin(makeSettings());
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["Q1 review"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["Q1 review"]);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("20240315-mtg.md");
		(mgr as any).onCreate(file);
		(mgr as any).onChanged(file);

		vi.advanceTimersByTime(500);

		expect(plugin.push).toHaveBeenCalledTimes(1);
		expect(plugin.push).toHaveBeenCalledWith(file, "auto");
		expect(mgr.debugSize().recentlyCreated).toBe(0);
	});

	it("does not push when autoPushNewNoteAliases is false", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPushNewNoteAliases: false }),
		);
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["X"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["X"]);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onCreate(file);
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		expect(plugin.push).not.toHaveBeenCalled();
	});
});

describe("onChanged — subsequent observations", () => {
	it("pushes on alias change when autoPushAllAliasChanges is enabled", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPushAllAliasChanges: true }),
		);
		let currentAliases = ["Jane"];
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: currentAliases },
		}));
		(parseFrontMatterAliases as any).mockImplementation(() => currentAliases);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");

		// Seed observation (no push).
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		// Alias changes — second observation triggers push.
		currentAliases = ["Jane Smith"];
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		expect(plugin.push).toHaveBeenCalledTimes(1);
	});

	it("does not push on second observation when arrays are equal", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPushAllAliasChanges: true }),
		);
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases: ["Jane"] },
		}));
		(parseFrontMatterAliases as any).mockReturnValue(["Jane"]);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);
		expect(plugin.push).not.toHaveBeenCalled();
	});

	it("does not push in general branch when autoPushAllAliasChanges is off", () => {
		const { plugin } = makePlugin(makeSettings()); // default: all = false
		let aliases = ["Jane"];
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases },
		}));
		(parseFrontMatterAliases as any).mockImplementation(() => aliases);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);
		aliases = ["Jane Smith"];
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);
		expect(plugin.push).not.toHaveBeenCalled();
	});
});

describe("AutoPushManager suppression and debounce", () => {
	it("recordWrite suppresses the immediately following changed event", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPushAllAliasChanges: true }),
		);
		let aliases = ["Jane"];
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases },
		}));
		(parseFrontMatterAliases as any).mockImplementation(() => aliases);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");

		// Seed snapshot.
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		aliases = ["Jane Smith"];
		mgr.recordWrite("a.md");
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		expect(plugin.push).not.toHaveBeenCalled();
	});

	it("debounce coalesces rapid changed events within 500ms into one fire", () => {
		const { plugin } = makePlugin(
			makeSettings({ autoPushAllAliasChanges: true }),
		);
		let aliases = ["Jane"];
		(plugin.app as any).metadataCache.getFileCache = vi.fn(() => ({
			frontmatter: { aliases },
		}));
		(parseFrontMatterAliases as any).mockImplementation(() => aliases);

		const mgr = new AutoPushManager(plugin);
		mgr.start();
		const file = makeTFile("a.md");
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		aliases = ["Jane Smith"];
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(200);
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(200);
		(mgr as any).onChanged(file);
		vi.advanceTimersByTime(500);

		expect(plugin.push).toHaveBeenCalledTimes(1);
	});
});
