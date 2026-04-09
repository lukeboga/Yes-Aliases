import { type App, Modal } from "obsidian";
import type { CompressOrphanResult } from "./compress";

export interface CompressConfirmModalProps {
	targetName: string;
	result: CompressOrphanResult;
	onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation modal shown when compressWarnInsteadOfBlock is true and
 * orphans were detected. Default focus is Cancel (hit Enter to dismiss
 * safely). No "don't show again" checkbox (FR-39).
 */
export class CompressConfirmModal extends Modal {
	private props: CompressConfirmModalProps;

	constructor(app: App, props: CompressConfirmModalProps) {
		super(app);
		this.props = props;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		titleEl.setText("Compress aliases — orphaned links detected");

		const { targetName, result } = this.props;
		const { strippedEntries, orphans, affectedSourcePaths } = result;

		// List up to 5 stripped entries, then "…and N more" (§15 resolution 3).
		const shown = strippedEntries.slice(0, 5);
		const rest = strippedEntries.length - shown.length;
		const entryList =
			shown.map((e) => `"${e}"`).join(", ") +
			(rest > 0 ? `, …and ${rest} more` : "");

		contentEl.createEl("p", {
			text: `Compressing ${targetName} will remove ${strippedEntries.length} alias entr${
				strippedEntries.length === 1 ? "y" : "ies"
			} (${entryList}). ${orphans.length} link${
				orphans.length === 1 ? "" : "s"
			} across ${affectedSourcePaths.size} file${
				affectedSourcePaths.size === 1 ? "" : "s"
			} currently show one of these aliases and will become orphaned.`,
		});

		contentEl.createEl("p", {
			text: "Orphaned links lose their migration path — the plugin will no longer recognize the old display text as an alias of the target, so future updates will not fix them.",
		});

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		const cancelButton = buttons.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		const confirmButton = buttons.createEl("button", {
			text: "Strip anyway",
			cls: "mod-warning",
		});
		confirmButton.addEventListener("click", () => {
			this.close();
			void this.props.onConfirm();
		});

		// NFR-21: default focus on Cancel.
		cancelButton.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
