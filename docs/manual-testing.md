# Manual Testing Guide — Yes Aliases

This checklist covers every command, context menu, setting, and edge case in the Yes Aliases plugin. Run against a dev vault with the plugin loaded.

---

## 1. Setup

### 1.1 Create target note with alias

1. **Setup:** Create `Notes/Alpha.md` with the following frontmatter:
   ```yaml
   ---
   aliases:
     - Alpha Display Name
   ---
   ```
2. **Action:** Save the file and wait for Obsidian's metadata cache to update (instant on small vaults).
3. **Expected:** The file is indexed. Running any Yes Aliases command on a link to `Alpha` will produce the alias `Alpha Display Name`.

### 1.2 Create source note with body links

1. **Setup:** Create `Notes/Source.md` with:
   ```markdown
   ---
   related: "[[Alpha]]"
   ---

   See [[Alpha]] for more.
   Also [[Alpha]] again.
   This one has display text: [[Alpha|Old Text]].
   ```
2. **Action:** Open the file in Obsidian.
3. **Expected:** File is open and editable. Cache shows two body links and one frontmatter link.

---

## 2. Update link under cursor

### 2.1 Body link in source mode — cursor inside link

1. **Setup:** Open `Notes/Source.md` in source mode. Ensure `Alpha.md` has `aliases: [Alpha Display Name]`.
2. **Action:** Place cursor inside `[[Alpha]]` on the body line. Run command **"Update link under cursor"** (command palette or hotkey).
3. **Expected:** `[[Alpha]]` becomes `[[Alpha|Alpha Display Name]]`. Notice says `Link updated: Alpha Display Name`.

### 2.2 Body link in source mode — cursor outside any link

1. **Setup:** Open `Notes/Source.md` in source mode.
2. **Action:** Place cursor on a blank line with no wikilink. Run **"Update link under cursor"**.
3. **Expected:** No change. Notice says `No wikilink under cursor`.

### 2.3 Frontmatter link in source mode — cursor inside link

1. **Setup:** Open `Notes/Source.md` in source mode. Ensure `updateFrontmatterLinks` is on (default).
2. **Action:** Scroll to the `related: "[[Alpha]]"` frontmatter line. Place cursor inside `[[Alpha]]`. Run **"Update link under cursor"**.
3. **Expected:** The frontmatter link becomes `[[Alpha|Alpha Display Name]]`. Notice says `Link updated: Alpha Display Name`.

### 2.4 Frontmatter link in source mode — updateFrontmatterLinks off

1. **Setup:** Open settings → Yes Aliases. Disable **Update frontmatter links**. Open `Notes/Source.md` in source mode, cursor inside frontmatter `[[Alpha]]`.
2. **Action:** Run **"Update link under cursor"**.
3. **Expected:** No change. Notice says `No wikilink under cursor` (frontmatter links are not searched when the setting is off).
4. **Cleanup:** Re-enable **Update frontmatter links**.

### 2.5 Live Preview — cursor inside body link

1. **Setup:** Open `Notes/Source.md` in Live Preview mode.
2. **Action:** Click to place cursor inside the rendered `[[Alpha]]` text in the body. Run **"Update link under cursor"**.
3. **Expected:** Link updates to `[[Alpha|Alpha Display Name]]`. Notice confirms update.

### 2.6 Live Preview — frontmatter shown as Properties UI (no-op for cursor command)

1. **Setup:** Open `Notes/Source.md` in Live Preview mode. The frontmatter renders as the Properties panel, not raw text.
2. **Action:** Click inside the Properties panel. Run **"Update link under cursor"**.
3. **Expected:** Notice says `No wikilink under cursor`. The cursor command cannot reach the Properties UI; use the context menu instead (see Section 5.4).

---

## 3. Update all links in current file

### 3.1 Both body and frontmatter links updated

1. **Setup:** Open `Notes/Source.md` (reset to have bare `[[Alpha]]` in body and frontmatter, no existing display text). Confirm `updateFrontmatterLinks` is on.
2. **Action:** Run **"Update all links in current file"** from the command palette.
3. **Expected:** All `[[Alpha]]` occurrences — body and frontmatter — become `[[Alpha|Alpha Display Name]]`. Notice says `N links updated, 0 skipped`.

### 3.2 Only frontmatter links (no body links)

1. **Setup:** Create `Notes/FrontmatterOnly.md`:
   ```markdown
   ---
   related: "[[Alpha]]"
   ---

   No body links here.
   ```
2. **Action:** Open the file, run **"Update all links in current file"**.
3. **Expected:** Frontmatter link updated. Notice says `1 links updated, 0 skipped`.

### 3.3 Only body links (no frontmatter)

1. **Setup:** Create `Notes/BodyOnly.md`:
   ```markdown
   See [[Alpha]] and [[Alpha]] again.
   ```
2. **Action:** Open the file, run **"Update all links in current file"**.
3. **Expected:** Both body links updated. Notice says `2 links updated, 0 skipped`.

### 3.4 Mixed: some links already have display text (overwriteExisting off)

1. **Setup:** Open a file containing:
   - `[[Alpha]]` — bare link
   - `[[Alpha|Old Text]]` — link with existing display text

   Confirm **Overwrite existing display text** is off (default).
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** `[[Alpha]]` → `[[Alpha|Alpha Display Name]]`. `[[Alpha|Old Text]]` unchanged. Notice says `1 links updated, 1 skipped`.

### 3.5 No links in file

1. **Setup:** Open a file with no wikilinks.
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** Notice says `No links to update`.

---

## 4. Update all links in current folder / vault

### 4.1 Folder — basic

1. **Setup:** Create `Folder/A.md` and `Folder/B.md`, each with `[[Alpha]]` in the body. Open either file.
2. **Action:** Run **"Update all links in current folder"**.
3. **Expected:** Both files updated. Notice says `2 files — N links updated, 0 skipped`.

### 4.2 Folder — recursive into subfolders

1. **Setup:** Create `Folder/Sub/C.md` with `[[Alpha]]`. Open a file in `Folder/`.
2. **Action:** Run **"Update all links in current folder"**.
3. **Expected:** `Folder/Sub/C.md` is included and updated. Notice reports the file count including the subfolder file.

### 4.3 Folder — with ignored folders

1. **Setup:** Open settings → Yes Aliases. Add `Folder/Sub` to **Ignored folders**. Ensure `Folder/Sub/C.md` has `[[Alpha]]`.
2. **Action:** Open a file in `Folder/`, run **"Update all links in current folder"**.
3. **Expected:** `Folder/Sub/C.md` is skipped. Notice does not include it in the file count.
4. **Cleanup:** Remove `Folder/Sub` from ignored folders.

### 4.4 Vault — basic

1. **Setup:** Several files in different folders with bare `[[Alpha]]` links.
2. **Action:** Run **"Update all links in vault"** from the command palette.
3. **Expected:** All qualifying links updated. Notice says `N files — M links updated, K skipped`.

### 4.5 Vault — ignored folders excluded

1. **Setup:** Add `_templates` to **Ignored folders**. Create `_templates/Template.md` with `[[Alpha]]`.
2. **Action:** Run **"Update all links in vault"**.
3. **Expected:** `_templates/Template.md` is not processed. Template file unchanged.
4. **Cleanup:** Remove `_templates` from ignored folders.

### 4.6 No active file (folder command)

1. **Setup:** Close all editor tabs so there is no active file.
2. **Action:** Run **"Update all links in current folder"**.
3. **Expected:** Notice says `No active file`. No files are modified.

---

## 5. Context menus

### 5.1 Source mode — right-click body link

1. **Setup:** Open `Notes/Source.md` in source mode. File has `[[Alpha]]` in body.
2. **Action:** Right-click directly on `[[Alpha]]` in the editor.
3. **Expected:** Context menu contains **"Update link alias"** item (with links-going-out icon).

### 5.2 Source mode — "Update link alias" from body context menu

1. **Setup:** Same as 5.1.
2. **Action:** Click **"Update link alias"** in the context menu.
3. **Expected:** `[[Alpha]]` → `[[Alpha|Alpha Display Name]]`. Notice says `Link updated: Alpha Display Name`.

### 5.3 Source mode — right-click on frontmatter link

1. **Setup:** Open `Notes/Source.md` in source mode, cursor near the frontmatter `[[Alpha]]`.
2. **Action:** Right-click on or near the frontmatter link.
3. **Expected:** Context menu appears with **"Update link alias"**. Clicking it updates the frontmatter link (same behavior as Section 2.3 via context menu).

### 5.4 Live Preview — Properties UI context menu

1. **Setup:** Open `Notes/Source.md` in Live Preview. The frontmatter renders as the Properties panel. Ensure `updateFrontmatterLinks` is on and `Alpha.md` has an alias.
2. **Action:** Right-click the `[[Alpha]]` link shown in the Properties UI.
3. **Expected:** Context menu contains **"Update link alias"**. Clicking it updates the frontmatter wikilink. Notice says `1 link updated: Alpha Display Name`.

### 5.5 Live Preview — Properties UI context menu, updateFrontmatterLinks off

1. **Setup:** Disable **Update frontmatter links** in settings. Open `Notes/Source.md` in Live Preview.
2. **Action:** Right-click the `[[Alpha]]` link in the Properties UI.
3. **Expected:** **"Update link alias"** does not appear in the menu (the handler returns early when the setting is off).
4. **Cleanup:** Re-enable **Update frontmatter links**.

### 5.6 Folder right-click — "Update link aliases in folder"

1. **Setup:** In the file explorer sidebar, navigate to a folder containing files with bare `[[Alpha]]` links.
2. **Action:** Right-click the folder in the file explorer.
3. **Expected:** Context menu contains **"Update link aliases in folder"**.

### 5.7 Folder right-click — execute folder update

1. **Setup:** Same as 5.6.
2. **Action:** Click **"Update link aliases in folder"**.
3. **Expected:** All qualifying links in the folder (and subfolders) are updated. Notice reports updated/skipped counts.

---

## 6. Setting: overwriteExisting

### 6.1 Off (default) — existing display text skipped

1. **Setup:** Open a file with `[[Alpha|Old Text]]`. Confirm **Overwrite existing display text** is off.
2. **Action:** Run **"Update link under cursor"** with cursor inside `[[Alpha|Old Text]]`.
3. **Expected:** No change. Notice says `Skipped — display text already set`.

### 6.2 Off — link already correct (alias matches display text)

1. **Setup:** Open a file with `[[Alpha|Alpha Display Name]]` (display text already equals the alias).
2. **Action:** Run **"Update link under cursor"** with cursor inside the link.
3. **Expected:** No change. Notice says `Link already up to date`.

### 6.3 On — existing display text replaced

1. **Setup:** Open a file with `[[Alpha|Old Text]]`. Enable **Overwrite existing display text**.
2. **Action:** Run **"Update link under cursor"** with cursor inside the link.
3. **Expected:** `[[Alpha|Old Text]]` → `[[Alpha|Alpha Display Name]]`. Notice says `Link updated: Alpha Display Name`.
4. **Cleanup:** Disable **Overwrite existing display text**.

### 6.4 On — already-correct link not re-written (no duplicate operation)

1. **Setup:** Open a file with `[[Alpha|Alpha Display Name]]`. Enable **Overwrite existing display text**.
2. **Action:** Run **"Update link under cursor"**.
3. **Expected:** No change. Notice says `Link already up to date`. The plugin does not rewrite links that are already correct even when overwrite is on.
4. **Cleanup:** Disable **Overwrite existing display text**.

---

## 7. Setting: updateFrontmatterLinks

### 7.1 On (default) — frontmatter links processed

1. **Setup:** Open `Notes/Source.md` with `related: "[[Alpha]]"` in frontmatter. Confirm **Update frontmatter links** is on.
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** Frontmatter `[[Alpha]]` updated to `[[Alpha|Alpha Display Name]]`. Stats include the frontmatter link.

### 7.2 Off — frontmatter links skipped

1. **Setup:** Disable **Update frontmatter links**. Open `Notes/Source.md` with bare `[[Alpha]]` in both frontmatter and body.
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** Body `[[Alpha]]` updated. Frontmatter `[[Alpha]]` unchanged. Stats reflect only the body link update.

### 7.3 Off — cursor command ignores frontmatter

1. **Setup:** Disable **Update frontmatter links**. Open `Notes/Source.md` in source mode. Place cursor inside the frontmatter `[[Alpha]]`.
2. **Action:** Run **"Update link under cursor"**.
3. **Expected:** Notice says `No wikilink under cursor`. The frontmatter link is not found.
4. **Cleanup:** Re-enable **Update frontmatter links**.

---

## 8. Edge cases

### 8.1 Singular `alias:` frontmatter key

1. **Setup:** Create `Notes/Beta.md` with:
   ```yaml
   ---
   alias: Beta Singular
   ---
   ```
   Create a source file with `[[Beta]]`.
2. **Action:** Run **"Update link under cursor"** with cursor on `[[Beta]]`.
3. **Expected:** `[[Beta]]` → `[[Beta|Beta Singular]]`. The plugin handles the singular `alias` key via the `parseFrontMatterStringArray` fallback.

### 8.2 Target has no alias

1. **Setup:** Create `Notes/NoAlias.md` with no frontmatter (or frontmatter without `aliases`/`alias`). Source file has `[[NoAlias]]`.
2. **Action:** Run **"Update link under cursor"** with cursor on `[[NoAlias]]`.
3. **Expected:** No change. Notice says `No alias found for target`.

### 8.3 Broken link (target file does not exist)

1. **Setup:** Source file has `[[Nonexistent]]`.
2. **Action:** Run **"Update link under cursor"** with cursor on `[[Nonexistent]]`.
3. **Expected:** No change. Notice says `No alias found for target`.

### 8.4 Duplicate frontmatter links

1. **Setup:** Create `Notes/Source.md` with:
   ```yaml
   ---
   related:
     - "[[Alpha]]"
     - "[[Alpha]]"
   ---
   ```
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** Both `[[Alpha]]` instances in frontmatter are updated independently. Neither occurrence overwrites the other. Notice shows `2 links updated`.

### 8.5 Link with subpath (heading anchor)

1. **Setup:** Source file has `[[Alpha#Section One]]`.
2. **Action:** Run **"Update link under cursor"** with cursor on the link.
3. **Expected:** `[[Alpha#Section One]]` → `[[Alpha#Section One|Alpha Display Name]]`. The subpath is preserved; only the display text is added.

### 8.6 Link with subpath and existing display text (overwriteExisting off)

1. **Setup:** Source file has `[[Alpha#Section One|Old Text]]`. `overwriteExisting` is off.
2. **Action:** Run **"Update link under cursor"**.
3. **Expected:** No change. Notice says `Skipped — display text already set`.

### 8.7 Embeds skipped

1. **Setup:** Source file has `![[Alpha]]` (embed syntax).
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** `![[Alpha]]` is not modified. Embeds are excluded from processing.

### 8.8 Link inside inline code skipped

1. **Setup:** Source file has `` `[[Alpha]]` `` (wikilink inside inline code span).
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** The link inside the inline code span is not modified.

### 8.9 Link inside fenced code block skipped

1. **Setup:** Source file has a fenced code block containing `[[Alpha]]`:
   ````markdown
   ```
   [[Alpha]]
   ```
   ````
2. **Action:** Run **"Update all links in current file"**.
3. **Expected:** The link inside the code block is not modified.

### 8.10 Multiple aliases — only first used

1. **Setup:** Create `Notes/Multi.md` with:
   ```yaml
   ---
   aliases:
     - First Alias
     - Second Alias
   ---
   ```
   Source file has `[[Multi]]`.
2. **Action:** Run **"Update link under cursor"** with cursor on `[[Multi]]`.
3. **Expected:** `[[Multi]]` → `[[Multi|First Alias]]`. Only `aliases[0]` is used.

### 8.11 File in ignored folder — folder command

1. **Setup:** Add `IgnoredDir` to **Ignored folders**. Create `IgnoredDir/Note.md` with `[[Alpha]]`. Open a file in the vault root.
2. **Action:** Run **"Update all links in vault"**.
3. **Expected:** `IgnoredDir/Note.md` is skipped. The file is unchanged.

### 8.12 Ignored folder prefix matching

1. **Setup:** Add `_meta` to **Ignored folders**. Create `_meta/templates/T.md` with `[[Alpha]]`.
2. **Action:** Run **"Update all links in vault"**.
3. **Expected:** `_meta/templates/T.md` is skipped. The prefix `_meta` matches `_meta/templates`.

---

## 9. Alias lifecycle — propagate, compress, remove (v0.1.0)

These procedures cover the new command families added in 0004. Each is copy-pasteable for regression testing.

### 9.0 Setup — extra fixtures

1. **Setup:** Create `people/jane.md` with the following frontmatter:
   ```yaml
   ---
   aliases:
     - Jane Smith
     - Jane
   ---
   ```
2. **Setup:** Create `Notes/Backlinker.md` with:
   ```markdown
   See [[people/jane|Jane]] today.
   Also [[people/jane|Jane Smith]] tomorrow.
   And [[people/jane|click here for Jane's profile]] for the prose case.
   ```
3. **Expected:** `people/jane.md` and `Notes/Backlinker.md` exist; the metadata cache reports three resolved links from Backlinker → people/jane.

### 9.1 Propagate — file scope

1. **Setup:** Section 9.0 fixtures present. `people/jane.md` has `aliases: [Jane Smith, Jane]`.
2. **Action:** Open `people/jane.md`. Run **"Propagate aliases for current file"** from the command palette.
3. **Expected:** In `Notes/Backlinker.md`:
   - `[[people/jane|Jane]]` → `[[people/jane|Jane Smith]]` (matched historical alias `Jane`, rewritten to canonical `aliases[0]`)
   - `[[people/jane|Jane Smith]]` unchanged (already canonical)
   - `[[people/jane|click here for Jane's profile]]` unchanged (prose, no alias match)
   - Notice reports 1 file, 1 link updated.

### 9.2 Propagate — folder scope (file-menu only)

1. **Setup:** Several files in `people/` each with `aliases:` and at least one backlink elsewhere whose display text matches a historical alias.
2. **Action:** Right-click the `people` folder in the file explorer.
3. **Expected:** **"Propagate aliases for files in folder"** appears in the menu.
4. **Action:** Click it.
5. **Expected:** Each file in `people/` is treated as a propagation target; backlinks to those targets are rewritten where the safe-rewrite rule allows. Notice reports a consolidated count.

### 9.3 Propagate — vault scope

1. **Setup:** Several aliased target files across the vault, each with at least one backlink. Add an `_archive` folder to **Ignored folders** containing one aliased file with backlinks.
2. **Action:** Run **"Propagate aliases across vault"** from the command palette.
3. **Expected:**
   - All non-ignored backlinks are processed.
   - Files in `_archive` are skipped both as propagation targets and as source files.
   - Notice reports the file/link counts.
4. **Cleanup:** Remove `_archive` from ignored folders.

### 9.4 Auto-propagate — new-note branch

1. **Setup:** Confirm **"Auto-update links when a new note gets its first alias"** is on (default).
2. **Action:** In an existing note, type `[[new-test-file]]`. Click the link to create `new-test-file.md`.
3. **Action:** Add `aliases: [Test Alias]` to its frontmatter and save.
4. **Expected:** Within ~500 ms (debounce), the original note's link updates to show `[[new-test-file|Test Alias]]`. No notice unless threshold is set to 0.
5. **Cleanup:** Delete `new-test-file.md` and the linking note.

### 9.5 Auto-propagate — all-alias-changes branch

1. **Setup:** Enable **"Auto-update links whenever any note's alias changes"**. Have an existing aliased note (e.g. `people/jane.md`) with several backlinks.
2. **Action:** Edit `people/jane.md`'s `aliases[0]` from `Jane Smith` to `Jane S.`.
3. **Expected:** Within ~500 ms, every backlink to `people/jane` whose display text matched `Jane Smith` is rewritten to `Jane S.`. If ≥ 6 files were affected (or threshold set lower), a consolidated notice appears.
4. **Cleanup:** Disable the all-changes setting; revert the alias.

### 9.6 Compress — no orphans

1. **Setup:** Open a file with `aliases: [Main, Historical]` where no backlink in the vault uses "Historical" as display text.
2. **Action:** Run **"Compress aliases in current file"** from the command palette.
3. **Expected:** Frontmatter becomes `aliases: [Main]`. Success notice.

### 9.7 Compress — orphans, strict refuse (default)

1. **Setup:** Same target file as 9.6 with `aliases: [Main, Historical]`. Create a backlink elsewhere using `[[target|Historical]]`. Confirm **"Warn instead of blocking"** is off.
2. **Action:** Run **"Compress aliases in current file"** on the target.
3. **Expected:** Frontmatter unchanged. Notice says `Cannot compress aliases — N link(s) across M file(s) still show alias entries that would be removed. Run "Propagate aliases across vault" first, or enable "Warn instead of blocking" in settings.`

### 9.8 Compress — orphans, warn modal

1. **Setup:** Same as 9.7 but enable **"Warn instead of blocking"**.
2. **Action:** Run **"Compress aliases in current file"**.
3. **Expected:** Modal opens. Title: "Compress aliases — orphaned links detected". Body lists the stripped entries (up to 5; "…and N more" if longer) and the orphan/file counts. Two buttons: **Cancel** (default focus) and **Strip anyway**.
4. **Action:** Press `Enter`.
5. **Expected:** Modal closes (Cancel was focused). Frontmatter unchanged.
6. **Action:** Run again, click **Strip anyway**.
7. **Expected:** Modal closes. Frontmatter is now `aliases: [Main]`. Backlinks using `Historical` are now orphaned (no alias entry recognizes them).
8. **Cleanup:** Disable **"Warn instead of blocking"**. Restore the historical alias if you want to re-test.

### 9.9 Compress — to main alias (always trims to 1)

1. **Setup:** A file with `aliases: [A, B, C, D]`. **"Main aliases to keep"** set to 3.
2. **Action:** Run **"Compress aliases to main alias"**.
3. **Expected:** Frontmatter becomes `aliases: [A]` regardless of the keep-count setting. Notice confirms.

### 9.10 Remove — cursor scope

1. **Setup:** Open a file containing `[[people/jane|Jane Smith]]`. Place cursor inside the link.
2. **Action:** Run **"Remove link alias under cursor"** from the command palette.
3. **Expected:** Link becomes `[[people/jane]]`. Notice confirms.

### 9.11 Remove — file scope, safe mode (default)

1. **Setup:** A file containing both `[[people/jane|Jane Smith]]` (alias-matching) and `[[people/jane|click here for Jane's profile]]` (prose). Confirm **"Remove also strips custom display text"** is off.
2. **Action:** Run **"Remove link aliases in current file"**.
3. **Expected:** `[[people/jane|Jane Smith]]` → `[[people/jane]]`. The prose link is unchanged. Notice reports 1 stripped, 1 preserved.

### 9.12 Remove — file scope, aggressive mode

1. **Setup:** Same fixture as 9.11. Enable **"Remove also strips custom display text"**.
2. **Action:** Run **"Remove link aliases in current file"** again.
3. **Expected:** `[[people/jane|click here for Jane's profile]]` → `[[people/jane]]`. Notice reports the strip.
4. **Cleanup:** Disable the aggressive setting.

### 9.13 Remove — folder scope (file-menu only)

1. **Setup:** Several files in a folder, each with at least one alias-matching link.
2. **Action:** Right-click the folder in the file explorer.
3. **Expected:** **"Remove link aliases in folder"** appears.
4. **Action:** Click it.
5. **Expected:** All matching links across the folder (recursive) are stripped. Notice reports counts.

### 9.14 Remove — vault scope

1. **Setup:** Alias-matching links across multiple folders. `_archive` in **Ignored folders** containing alias-matching links that should be untouched.
2. **Action:** Run **"Remove link aliases in vault"** from the command palette.
3. **Expected:** All non-ignored alias-matching links are stripped. `_archive` files are unchanged. Notice reports a consolidated count.
4. **Cleanup:** Remove `_archive` from ignored folders.

### 9.15a Inclusive boundary — wikilink heading and block anchors

1. **Setup:** `other.md` has `aliases: [Other Alias]` and a `## Heading` plus a `paragraph ^abc` block. Create a file with:
   ```markdown
   [[other#Heading]]
   [[other#^abc]]
   ```
2. **Setup:** Confirm **"Preserve heading and block anchors"** is off (default).
3. **Action:** Run **"Update all links in current file"** (existing pull-update).
4. **Expected:**
   - `[[other#Heading]]` → `[[other#Heading|Other Alias]]`
   - `[[other#^abc]]` → `[[other#^abc|Other Alias]]`
5. **Action:** Enable **"Preserve heading and block anchors"** and re-run on a fresh fixture.
6. **Expected:** Heading and block wikilink variants are now skipped.
7. **Cleanup:** Disable **"Preserve heading and block anchors"**.

### 9.15b Inclusive boundary — embeds (DEFERRED to v0.1.1)

> **Status:** v0.1.0 does not iterate `cache.embeds` in any writer. This scenario is preserved for v0.1.1 verification. Full root-cause analysis, fix sketch, and forward-compat reasoning live in `project/planning/backlog.md` → "v0.1.1 — Embed support".

1. **Setup:** Same `other.md` as 9.15a. Create a file with:
   ```markdown
   ![[other]]
   ![[other#Heading]]
   ![[other#^abc]]
   ![[other|Caption]]
   ```
2. **Setup:** Confirm **"Preserve heading and block anchors"** is off (default).
3. **Action:** Run **"Update all links in current file"** (existing pull-update).
4. **Expected after v0.1.1 fix:**
   - `![[other]]` → `![[other|Other Alias]]`
   - `![[other#Heading]]` → `![[other#Heading|Other Alias]]`
   - `![[other#^abc]]` → `![[other#^abc|Other Alias]]`
   - `![[other|Caption]]` unchanged (custom caption preserved unless overwrite is on)
5. **Action:** Enable **"Preserve heading and block anchors"** and re-run.
6. **Expected after v0.1.1 fix:** Heading and block embed variants are now skipped. Plain embed `![[other]]` still participates.
7. **Cleanup:** Disable **"Preserve heading and block anchors"**.

**v0.1.0 actual (recorded):** all four `![[..]]` embeds remain unchanged after pull-update. Wikilink anchored variants (9.15a) work correctly.

### 9.16 Context menu — Remove link alias (body wikilink, source mode)

1. **Setup:** Open `Notes/Backlinker.md` in source mode.
2. **Action:** Right-click directly on `[[people/jane|Jane Smith]]`.
3. **Expected:** Context menu contains **"Remove link alias"**.
4. **Action:** Click it.
5. **Expected:** Link becomes `[[people/jane]]`. Notice confirms.

### 9.17 Context menu — Remove link alias (Live Preview body link)

1. **Setup:** Same file in Live Preview mode.
2. **Action:** Right-click on the rendered link.
3. **Expected:** **"Remove link alias"** appears in the menu and removes the alias on click.

### 9.18 Context menu — Remove link alias (source-mode YAML wikilink)

1. **Setup:** A file with `related: "[[people/jane|Jane Smith]]"` in frontmatter, opened in source mode.
2. **Action:** Right-click on the frontmatter `[[people/jane|Jane Smith]]`.
3. **Expected:** Context menu contains **"Remove link alias"**. Clicking it strips the display text from the YAML wikilink.

### 9.19 Context menu — Remove link alias (Properties UI, Live Preview)

1. **Setup:** Same file in Live Preview. The frontmatter renders as the Properties panel.
2. **Action:** Right-click the link in the Properties panel.
3. **Expected:** **"Remove link alias"** appears. Clicking it strips display text from **all** frontmatter links to that target (documented limitation, mirrors the existing update behavior).

---

## 10. CLI-driven dogfood automation

This section captures the dogfood automation patterns developed during sessions 011–012. When running structured scenario tests against the dev vault, these patterns let you drive most of this document via `obsidian eval` + the `obsidian` CLI, reserving manual (eyes-on) steps for UX/rendering checks where the CLI cannot faithfully substitute.

**Not applicable to:** the scenario prose above in sections 1–9, which remains the canonical source of truth for what should be tested. Section 10 only describes *how* to drive the scenarios when automating rather than clicking through by hand.

### 10.1 When to use CLI-driven vs manual

| Category | CLI-driven | Manual (eyes-on) |
|---|---|---|
| File/folder/vault scope commands via palette | ✅ Faithful: `executeCommandById` + `vault.read`/`editor.getValue` + `.notice` DOM capture | — |
| Cursor-scope commands (body links, both modes) | ✅ Via `editor.setCursor` + `executeCommandById` — verified faithful for body links; session 011 FM-LP bug was specific to YAML editor, not body cursor | — |
| Context menu items (file-menu, editor-menu) | ✅ Via synthetic Menu shim (see §10.5) | Eyes-on for initial verification that menu items appear, labels read correctly, ordering feels right |
| Settings tab walkthrough | — | Manual — eyes-on for sentence case, control layout, accessibility |
| Live Preview visual rendering | — | Manual — only eyes can verify widget rendering, Properties panel behavior |
| Auto-propagation timing / feedback loops | ✅ With explicit waits (§10.4) | — |
| Plugin reload verification | ✅ `obsidian plugin:reload id=yes-aliases` + `dev:errors` | — |

### 10.2 Complex eval via `/tmp/*.js` heredoc (CRITICAL pattern)

Multi-line async IIFEs with template literals passed directly to `obsidian eval code="..."` **silently fail** — the command returns empty output with no error. Simple single-expression evals work fine.

**Workaround that is 100% reliable:**

```bash
cat > /tmp/yatest-something.js <<'JSEOF'
(async () => {
  try {
    // ... your complex test code here ...
    return 'OK';
  } catch (e) {
    return 'ERROR: ' + e.message + ' :: ' + (e.stack || '');
  }
})()
JSEOF
CODE=$(cat /tmp/yatest-something.js); obsidian eval code="$CODE"
```

Notes:
- Use single-quoted `'JSEOF'` heredoc terminator so bash does not expand `$` or backticks inside the JS.
- Always wrap in `try/catch` so silent failures become visible as `ERROR: ...` in the eval return.
- `/tmp/yatest-*.js` is the naming convention — disposable, OS-cleaned, greppable.
- For short one-line evals, inline `obsidian eval code="..."` is fine.

### 10.3 Result capture via vault JSON artifact

For complex test results (nested objects, arrays, multi-case batches), `obsidian eval` stdout can be unreliable for round-tripping. Write the result to a JSON file inside the vault and read it back via `obsidian read`:

```js
const p = '_staging-v0.1.0/_results-NAME.json';
const existing = app.vault.getAbstractFileByPath(p);
if (existing) await app.vault.modify(existing, JSON.stringify(results, null, 2));
else await app.vault.create(p, JSON.stringify(results, null, 2));
return 'wrote ' + results.length + ' entries';
```

Then in bash:

```bash
obsidian read path="_staging-v0.1.0/_results-NAME.json"
```

**Clean up these `_results-*.json` / `_debug*.json` artifacts at session end** — via `app.vault.trash(file, true)` for each. They are session-scoped and should not be committed.

### 10.4 Timing (load-bearing for flake-free automation)

- **After `app.vault.modify`:** wait **≥ 1500 ms** before placing the cursor, reading the metadata cache, or running a command that depends on fresh cache. Obsidian's metadata cache update trails disk writes by ~1 s. Tight loops (`modify → setCursor → command`) without this wait produce false negatives where the command reports `"No wikilink under cursor"` or fails to find links that are visibly present in the file.
- **After `app.commands.executeCommandById`:** wait **≥ 2500 ms** before reading file state, especially for bulk (folder/vault) commands. The notice and file write can complete in stages.
- **Between cases in a batch test:** `reset()` then wait **≥ 2000 ms** so debounced auto-propagate handlers (500 ms debounce per `auto-propagate.ts::DEBOUNCE_MS`) fire and settle before the next case.
- **Editor flush-lag (session-011 caveat):** body changes via `applyChangesInEditor` (i.e., `updateLinksInFile`/`removeLinksInFile` body-only paths) write via `editor.replaceRange` but the disk file may not reflect the change for 1–2 s. Prefer `editor.getValue()` over `vault.read()` when verifying body-only changes. FM-path changes go through `vault.process` and are on disk immediately.

### 10.5 Synthetic Menu shim for file-menu and editor-menu automation

Right-click context menu items can't be driven directly from `obsidian eval`. The workaround is a fake Menu object that captures `addItem` callbacks. Trigger the workspace event with this fake menu, find the captured item by title, call its `_onClick`.

**Complete shim — add all stub methods to avoid `dev:errors` noise from Obsidian's own listeners:**

```js
const makeFakeMenu = () => {
  const captured = [];
  const fakeMenu = {
    addItem: (cb) => {
      const item = {
        _title: '', _icon: '', _onClick: null,
        setTitle(t) { this._title = t; return this; },
        setIcon(i) { this._icon = i; return this; },
        onClick(fn) { this._onClick = fn; return this; },
        setSection() { return this; },
        setDisabled() { return this; },
        setSubmenu() { return this; },
        setChecked() { return this; },
        setSectionSubmenu() { return this; },
      };
      cb(item);
      captured.push(item);
      return fakeMenu;
    },
    addSeparator() { return fakeMenu; },
  };
  return { fakeMenu, captured };
};
```

**Note (session 012):** `setSectionSubmenu` was added to this shim during session 012. Prior handoffs (session 011) had `setSection` but missed `setSectionSubmenu`, producing `TypeError: e.setSectionSubmenu is not a function` in captured errors. Both are test-scaffold noise (our plugin's items only use `setTitle`/`setIcon`/`onClick`), but extending the shim keeps `dev:errors` clean.

**Triggering the events:**

```js
// Folder file-menu (on a TFolder target)
app.workspace.trigger('file-menu', fakeMenu, folder, 'file-explorer-context-menu');

// Body-link file-menu (on a TFile target — the wikilink's resolved target file)
app.workspace.trigger('file-menu', fakeMenu, targetFile, 'link-context-menu');

// Editor menu (for source-mode YAML wikilinks)
app.workspace.trigger('editor-menu', fakeMenu, editor, view);
```

**Finding the item:** `captured.find(i => i._title === 'Exact Title Here')`. Always dump `captured.map(i => i._title)` once to confirm the exact title before hardcoding it. As of v0.1.0 the canonical titles are:

| Title | Trigger source |
|---|---|
| `Update link alias` | file-menu, link-context-menu (body links) |
| `Remove link alias` | file-menu, link-context-menu (body links) |
| `Update link aliases in folder` | file-menu, file-explorer-context-menu |
| `Propagate aliases for files in folder` | file-menu, file-explorer-context-menu |
| `Remove link aliases in folder` | file-menu, file-explorer-context-menu |

### 10.6 Body-link file-menu disambiguation (editor vs Properties UI)

The body-link file-menu handler in `src/main.ts` has two branches keyed off `this.lastContextmenuCoords`:
- **Editor path** — click landed inside the CodeMirror `contentDOM` rect. Delegates to `updateLinkUnderCursor` / `removeLinkUnderCursor` against the current cursor position.
- **Properties UI path (LP only)** — click landed outside the `contentDOM` rect (i.e., on the Properties widget). Delegates to `updateLinksInFile` / `removeLinksInFile` with `{targetFile, frontmatterOnly: true}`.

To force the **editor path** in a CLI test: place the cursor on the link, then set `plugin.lastContextmenuCoords = {x: rect.left + 10, y: rect.top + 10}` where `rect = editor.cm.contentDOM.getBoundingClientRect()`. The `plugin` reference is `app.plugins.plugins['yes-aliases']`. The field is `private` in TypeScript but accessible at runtime.

To force the **Properties UI path**: set `plugin.lastContextmenuCoords = null` (or coords outside the `contentDOM` rect).

### 10.7 Notice capture

Notices render as `.notice` DOM elements and auto-fade after ~4–5 s. Capture within the eval IIFE, immediately after the command:

```js
document.querySelectorAll('.notice').forEach(n => n.remove());  // clear before command
await app.commands.executeCommandById('yes-aliases:...');
await new Promise(r => setTimeout(r, 800));
const notices = Array.from(document.querySelectorAll('.notice')).map(n => n.textContent);
```

Do not capture in a separate eval after a wait — notices will be gone.

### 10.8 Scope-limiting vault-wide tests via `ignoredFolders`

To run vault-wide commands but scope them to a specific fixture folder (e.g., `_staging-v0.1.0/`), add every *other* top-level folder to `ignoredFolders` temporarily. Always capture the original value and restore in a try/finally (or equivalent):

```js
const plugin = app.plugins.plugins['yes-aliases'];
const originalIgnored = [...plugin.settings.ignoredFolders];
plugin.settings.ignoredFolders = ['__meta__', '_development', 'ntag', '_staging-v0.1.0/_archive'];
await plugin.saveSettings();
try {
  // ... run vault-scope tests ...
} finally {
  plugin.settings.ignoredFolders = originalIgnored;
  await plugin.saveSettings();
}
```

### 10.9 Auto-propagate state inspection

`plugin.autoPropagate` is an `AutoPropagationManager` instance. Its private maps are accessible at runtime:

```js
const ap = app.plugins.plugins['yes-aliases'].autoPropagate;
const snapshot = Object.fromEntries(ap.aliasSnapshot);      // path → alias array
const recent = [...ap.recentlyCreated.keys()];              // paths with active TTL
const inflight = Object.fromEntries(ap.inFlightWrites);     // path → last-write ts
// debugSize() is a public method that returns counts for all four maps
const counts = ap.debugSize();
```

**Post-BUG-#8-fix observable:** immediately after `obsidian plugin:reload id=yes-aliases`, `recent.length` must be `0` (until the user creates a genuinely new file). On the pre-fix build this returns 30+ because `vault.on('create')` fired for every existing file during initial index.

### 10.10 Character positions for cursor placement

When using `editor.setCursor({line, ch})`, the `line` is 0-indexed from the start of the file and `ch` is 0-indexed from the start of the line. LF linebreaks. For a canonical smoke-test source file with layout:

```
# Source

Bare link: [[target]]

Alias match (canonical): [[target|Alpha Display]]

Alias match (historical): [[target|Alpha Legacy]]

Prose display (should be preserved): [[target|some prose]]
```

…the line indices are 0,2,4,6,8 (evens are content, odds are blank). Character offsets inside each link are roughly `ch 20`, `ch 35`, `ch 35`, `ch 45` for lines 2/4/6/8 respectively (depends on the exact target path length).

### 10.11 Command IDs for `executeCommandById`

As of v0.1.0, the registered command IDs are:

| Command ID | Scope | Palette |
|---|---|---|
| `yes-aliases:update-link-under-cursor` | cursor | yes |
| `yes-aliases:update-links-in-file` | file | yes |
| `yes-aliases:update-links-in-vault` | vault | yes |
| `yes-aliases:update-links-in-folder` | folder | file-menu only |
| `yes-aliases:propagate-aliases-file` | file | yes |
| `yes-aliases:propagate-aliases-vault` | vault | yes |
| `yes-aliases:compress-aliases-file` | file | yes |
| `yes-aliases:compress-aliases-file-to-main` | file | yes |
| `yes-aliases:remove-link-alias-under-cursor` | cursor | yes |
| `yes-aliases:remove-link-aliases-in-file` | file | yes |
| `yes-aliases:remove-link-aliases-in-vault` | vault | yes |

Folder-scope propagate and remove are file-menu items only (no command ID for `executeCommandById`). Drive them via the synthetic Menu shim (§10.5).

**Common pitfall:** The propagate-file command ID is `propagate-aliases-file`, NOT `propagate-aliases-from-file`. The command names don't always match the notice text. Always verify with:

```js
Object.keys(app.commands.commands).filter(k => k.startsWith('yes-aliases'))
```

### 10.12 Direct plugin method calls

When `executeCommandById` requires a specific active file or editor state that's hard to set up, call the plugin method directly:

```js
const plugin = app.plugins.plugins['yes-aliases'];
const tf = app.vault.getAbstractFileByPath('path/to/target.md');
await plugin.propagate(tf, 'manual');
```

This bypasses the command's `editorCallback` / `checkCallback` gating and executes the operation directly. Useful for propagate-from-file when you need to control which file is the propagation target.

### 10.13 Compress interlock testing

The compress interlock refuses when backlinks still use aliases that would be stripped. Testing the full interlock lifecycle:

1. **Refuse (strict):** Reset fixtures to canonical state (source has historical-alias backlink). Run compress on target. Expect refuse notice, target unchanged.
2. **Success after propagate:** Propagate from target first (migrates all historical backlinks to canonical). Then compress. Expect success — alias removed.
3. **Warn modal (when `compressWarnInsteadOfBlock=true`):** Enable setting, reset fixtures, run compress. Modal appears with "Cancel" + "Strip anyway" buttons. Capture modal via `document.querySelector('.modal-container')`.
4. **Compress-to-main ignores `aliasesKeepCount`:** Set `aliasesKeepCount=2`, run `compress-aliases-file-to-main`. Always trims to 1 regardless.

### 10.14 Auto-propagation testing (post-BUG-#8 fix)

Auto-propagation tests are only meaningful on a build with the `onLayoutReady` fix (commit `450559d`+). On pre-fix builds, `recentlyCreated` is polluted with every pre-existing file and results are unreliable.

**Baseline check:** After `obsidian plugin:reload id=yes-aliases`, verify `[...ap.recentlyCreated.keys()].length === 0`. Any non-zero count (excluding files genuinely created this session) indicates the fix isn't active.

**New-note auto-propagation (8a pattern):**
1. Create a backlinker with a bare link to a not-yet-existing target
2. Create the target note with aliases via `app.vault.create`
3. Wait 4+ seconds (debounce + propagation)
4. Read backlinker — bare link should have alias display text

**Alias-change auto-propagation (8b pattern):**
1. Enable `autoPropagateAllAliasChanges`
2. Reset fixtures, wait 4+ seconds for alias snapshot to seed
3. Modify target's `aliases[0]` via `app.vault.modify`
4. Wait 5+ seconds (debounce + propagation)
5. Read source — canonical and bare links should show new alias

**Important:** Always restore settings and fixtures in a try/finally pattern.

### 10.15 Heading and block anchor testing

Build a fixture with 5 link types to the same target: plain `[[target]]`, heading `[[target#Heading]]`, block `[[target#^block1]]`, heading-aliased `[[target#Heading|OldAlias]]`, block-aliased `[[target#^block1|OldAlias]]`.

- **`preserveHeadingAndBlockAnchors=false` (default):** All 5 rewrite. Anchors are preserved in the output: `[[target#Heading|NewAlias]]`.
- **`preserveHeadingAndBlockAnchors=true`:** Only the plain link rewrites. All heading/block variants (bare and aliased) are skipped.

### 10.16 Frontmatter link testing

Build a fixture with wikilinks in YAML frontmatter properties (quoted): `related: "[[target]]"`, `historical: "[[target|OldAlias]]"`, etc. All three operations (update, propagate, remove) should process FM links identically to body links, with the same safe-rewrite rules applied. FM links route through `vault.process` in both source and Live Preview modes (the session-010 FM-LP fix).

### 10.17 Shim noise in `dev:errors`

The synthetic Menu shim (§10.5) produces `TypeError: e.setSectionSubmenu is not a function` entries in `dev:errors`. These come from Obsidian's own internal listeners on the `file-menu` / `editor-menu` workspace events — not from the plugin. The shim stubs `setSectionSubmenu` on menu *items*, but Obsidian's listeners call it on the *menu object* itself. This is test-scaffold noise only and can be safely ignored. If `dev:errors` shows errors from plugin code paths (stack traces in `main.js` or `src/`), those are real.

---
