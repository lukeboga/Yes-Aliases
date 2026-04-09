import {
	type App,
	type EventRef,
	type TAbstractFile,
	TFile,
} from "obsidian";
import type { YesAliasesSettings } from "./settings";

const RECENTLY_CREATED_TTL_MS = 30 * 60 * 1000; // 30 minutes
const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * Narrow host interface for the manager. Avoids importing the full
 * `YesAliasesPlugin` class (which would require its `propagate` method
 * stub to exist before Phase 7 wires it up).
 */
export interface AutoPropagationHost {
	app: App;
	settings: YesAliasesSettings;
	registerEvent(eventRef: EventRef): void;
	registerInterval(id: number): number;
	propagate(file: TFile, source: "auto" | "manual"): void;
}

function isMarkdownFile(f: TAbstractFile): f is TFile {
	return f instanceof TFile && f.extension === "md";
}

/** Lifecycle + in-memory state for automatic alias propagation. */
export class AutoPropagationManager {
	private plugin: AutoPropagationHost;

	/** Lazy snapshot of last-observed aliases per file. Never persisted. */
	private aliasSnapshot: Map<string, string[]> = new Map();

	/** Recently-created files → expiry timestamp (ms epoch). Never persisted. */
	private recentlyCreated: Map<string, number> = new Map();

	/** Files the plugin has recently written to → last-write timestamp. */
	private inFlightWrites: Map<string, number> = new Map();

	/** Per-file 500 ms trailing debounce timers for the changed handler. */
	private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
		new Map();

	constructor(plugin: AutoPropagationHost) {
		this.plugin = plugin;
	}

	start(): void {
		const { app } = this.plugin;

		this.plugin.registerEvent(
			app.vault.on("create", (file: TAbstractFile) => this.onCreate(file)),
		);
		this.plugin.registerEvent(
			app.vault.on("delete", (file: TAbstractFile) => this.onDelete(file)),
		);
		this.plugin.registerEvent(
			app.vault.on("rename", (file: TAbstractFile, oldPath: string) =>
				this.onRename(file, oldPath),
			),
		);
		this.plugin.registerEvent(
			app.metadataCache.on("changed", (file: TFile) => this.onChanged(file)),
		);

		// Obsidian's Plugin.registerInterval expects a browser-style timer id
		// (number). At runtime the plugin runs in Electron where setInterval
		// returns a number; the cast is purely to satisfy TS strict mode under
		// the @types/node ambient declaration.
		this.plugin.registerInterval(
			setInterval(
				() => this.pruneExpired(),
				EXPIRY_CHECK_INTERVAL_MS,
			) as unknown as number,
		);
	}

	stop(): void {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.aliasSnapshot.clear();
		this.recentlyCreated.clear();
		this.inFlightWrites.clear();
	}

	/** Called by writer code just before any plugin-initiated write. */
	recordWrite(path: string): void {
		this.inFlightWrites.set(path, Date.now());
	}

	/** Debug hook used by tests to assert clean state. */
	debugSize(): {
		aliasSnapshot: number;
		recentlyCreated: number;
		inFlightWrites: number;
		debounceTimers: number;
	} {
		return {
			aliasSnapshot: this.aliasSnapshot.size,
			recentlyCreated: this.recentlyCreated.size,
			inFlightWrites: this.inFlightWrites.size,
			debounceTimers: this.debounceTimers.size,
		};
	}

	// ─── Handlers (stubs; filled out in subsequent tasks) ───

	private onCreate(file: TAbstractFile): void {
		if (!isMarkdownFile(file)) return;
		this.recentlyCreated.set(
			file.path,
			Date.now() + RECENTLY_CREATED_TTL_MS,
		);
	}

	private onDelete(file: TAbstractFile): void {
		const path = file.path;
		this.aliasSnapshot.delete(path);
		this.recentlyCreated.delete(path);
		this.inFlightWrites.delete(path);
		const timer = this.debounceTimers.get(path);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(path);
		}
	}

	private onRename(file: TAbstractFile, oldPath: string): void {
		const newPath = file.path;
		if (oldPath === newPath) return;

		const snapshot = this.aliasSnapshot.get(oldPath);
		if (snapshot !== undefined) {
			this.aliasSnapshot.delete(oldPath);
			this.aliasSnapshot.set(newPath, snapshot);
		}

		const recent = this.recentlyCreated.get(oldPath);
		if (recent !== undefined) {
			this.recentlyCreated.delete(oldPath);
			this.recentlyCreated.set(newPath, recent);
		}

		const inflight = this.inFlightWrites.get(oldPath);
		if (inflight !== undefined) {
			this.inFlightWrites.delete(oldPath);
			this.inFlightWrites.set(newPath, inflight);
		}

		const timer = this.debounceTimers.get(oldPath);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(oldPath);
			// Do not reschedule — the next changed event for newPath
			// starts a fresh debounce.
		}
	}

	private onChanged(_file: TFile): void {
		// Tasks 6.3 – 6.5
	}

	private pruneExpired(): void {
		const now = Date.now();
		for (const [path, expiry] of this.recentlyCreated.entries()) {
			if (expiry <= now) this.recentlyCreated.delete(path);
		}
		// In-flight writes are pruned lazily at check time (see onChanged).
	}
}
