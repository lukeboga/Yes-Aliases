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
