import { vi } from "vitest";

export const parseFrontMatterAliases = vi.fn();
export const parseFrontMatterStringArray = vi.fn();

export class TFile {
	path = "";
	extension = "md";
	parent: TFolder | null = null;
}

export class TFolder {
	path = "";
	name = "";
	children: (TFile | TFolder)[] = [];
}

export const Vault = {
	recurseChildren: vi.fn(),
};

export class Notice {
	constructor(_msg: string) {}
}

export class Plugin {
	app: any;
	registerEvent = vi.fn();
	registerInterval = vi.fn();
	registerDomEvent = vi.fn();
}

export class Modal {
	app: any;
	contentEl: any = {
		empty: vi.fn(),
		createEl: vi.fn(() => ({ setText: vi.fn() })),
		createDiv: vi.fn(() => ({ createEl: vi.fn() })),
	};
	titleEl: any = { setText: vi.fn() };
	constructor(app: any) {
		this.app = app;
	}
	open = vi.fn();
	close = vi.fn();
	onOpen(): void {}
	onClose(): void {}
}

export interface LinkCache {
	original: string;
	link: string;
	displayText?: string;
	position: {
		start: { offset: number; line?: number; col?: number };
		end: { offset: number; line?: number; col?: number };
	};
}

export interface FrontmatterLinkCache {
	original: string;
	link: string;
	displayText?: string;
	key: string;
}

export interface SectionCache {
	type: string;
	position: {
		start: { offset: number };
		end: { offset: number };
	};
}

export interface CachedMetadata {
	links?: LinkCache[];
	frontmatterLinks?: FrontmatterLinkCache[];
	sections?: SectionCache[];
	frontmatter?: Record<string, unknown>;
}
