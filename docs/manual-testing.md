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
