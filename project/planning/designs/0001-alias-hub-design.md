# Alias Hub Plugin — Design Document

**Date:** 2026-04-02
**Requirements:** `project/planning/requirements/0001-alias-hub-plugin-req.md`
**Status:** Approved

## 1 Purpose

Propagate aliases from target files into wikilink display text. For each wikilink in scope, set display text to `aliases[0]` of the target file's frontmatter. Manual, command-driven — no live/on-type updating.

## 2 Core Requirements (PRD-Level)

- Set wikilink display text to target file's `aliases[0]`
- Four scope levels: single link (cursor), file, folder (recursive), vault
- All four in command palette; cursor and folder also in context menus
- Skip: no alias, empty aliases, broken link, embeds, markdown links, code blocks, inline code, frontmatter, already-correct display text
- Preserve heading and block references (`#heading`, `#^block-id`)
- Settings: overwrite existing display text (default off), ignored folder list
- Summary notices for bulk operations, brief notices for single operations
- No UI blocking on large vaults (10k+ files)
- Desktop and mobile compatible, no external dependencies
- TypeScript strict mode, modular, testable, extensible pipeline

## 3 Approach: Split Strategy

Different tools for different scopes. Two scope categories have fundamentally different runtime contexts:

- **Live scope** (cursor, file): File is open in the editor. Use the Editor API — `editor.replaceRange()` for surgical updates. No file I/O. Immediate, supports undo/redo.
- **Bulk scope** (folder, vault): Files aren't open. Use cache-first pre-filtering with `vault.process()`. Only files that need changes hit disk.

Both paths share the same alias resolution logic and decision pipeline. Only the rewrite mechanism differs.

### 3.1 Why This Approach

Performance is critical — vaults can have tens of thousands of files. The biggest win for bulk operations is **pre-filtering via metadataCache**: determine which files need changes before doing any I/O. Files where all links are already correct are skipped entirely.

For live operations, the Editor API is both faster (no disk round-trip) and better UX (native undo support).

### 3.2 Alternatives Considered

**Full regex parsing:** Parse raw content directly for wikilinks, skipping code/frontmatter regions. Handles all skip regions naturally but cannot pre-filter — must read every file. Duplicates parsing Obsidian already does.

**Pure metadataCache with offset replacement:** Use cache for everything including raw offset-based replacement. Fastest per-file, but vulnerable to cache staleness (stale offsets can corrupt writes). Inline code spans are not tracked in cache sections.

## 4 Architecture

```
┌─────────────────────────────────────┐
│  Commands & Scope Layer             │
│  (cursor, file, folder, vault)      │
│  Determines WHAT to process,        │
│  delegates to core                  │
├─────────────────────────────────────┤
│  Core Pipeline                      │
│  resolve link → resolve alias →     │
│  decide → rewrite                   │
├──────────────────┬──────────────────┤
│  Editor Writer   │  Vault Writer    │
│  (live scope)    │  (bulk scope)    │
└──────────────────┴──────────────────┘
```

### 4.1 Core Pipeline

Pure decision logic. No I/O, no side effects, no Obsidian imports.

**Input:**
- `original`: raw wikilink text (e.g., `[[file#heading|Old Text]]`)
- `hasExplicitDisplayText`: whether `original` contains `|` (cache's `displayText` field is always populated even without explicit display text — must check `original` for `|`)
- `currentDisplayText`: the explicit display text if present, else `null`
- `targetAlias`: `aliases[0]` from target file, or `null` if none/empty

**Settings context:**
- `overwriteExisting`: boolean

**Decision logic (in order):**
1. No target alias → **skip**
2. Has explicit display text matching target alias → **skip** (already correct)
3. Has explicit display text and `overwriteExisting` is false → **skip**
4. Otherwise → **rewrite**: produce `[[linkpath|alias]]`

**Output:** `{ action: 'skip', reason: string }` or `{ action: 'rewrite', newText: string }`

Rewrite construction: `[[` + original link path including any `#heading` or `#^block-id` subpath + `|` + alias + `]]`. Link path extracted from `original` (everything between `[[` and the first `|` or `]]`).

### 4.2 Alias Resolution

Standalone function, separate from the pipeline. Uses Obsidian API.

1. `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` → target `TFile`
2. `metadataCache.getFileCache(targetFile)?.frontmatter` → frontmatter
3. `parseFrontMatterAliases(frontmatter)?.[0]` → first alias or `null`

Returns `null` for broken links, missing frontmatter, or empty aliases.

### 4.3 Link Filtering

Determines which links are candidates for processing. Two mechanisms:

**Section filtering:** Compare each link's offset range against `cache.sections` entries with `type === 'yaml'` or `type === 'code'`. Links inside these ranges are excluded.

**Inline code detection:** For each candidate link position, scan backward from the link's start offset for an unmatched opening backtick, and forward from the end offset for a closing backtick. If the link sits between a matched backtick pair on the same line, skip it. O(1) per link.

**Embed filtering:** Check the character at `position.start.offset - 1` in the file content for `!`. If present, skip (embed syntax). In the editor path, use `editor.getValue()`; in the vault path, use the content string inside `vault.process()`. The cache does not distinguish embeds in `links` — `cache.embeds` is a separate array, but links may also appear there, so the content check is the reliable method.

### 4.4 Editor Writer (Live Scope)

**Cursor command:**
1. Get cursor position from editor
2. Find link in `cache.links` whose position range contains cursor offset
3. If no link → notice "No wikilink under cursor", return
4. Run filter checks, resolve alias, run pipeline
5. If rewrite: `editor.replaceRange(newText, linkStart, linkEnd)`
6. Brief notice

**File command:**
1. Get `cache.links` and `cache.sections` for active file
2. Filter out yaml/code section links and inline code links (uses `editor.getValue()` for inline code check)
3. For each remaining link: resolve alias, run pipeline
4. Collect rewrites, apply in **reverse offset order** via `editor.replaceRange()`
5. Notice: "X links updated, Y skipped"

### 4.5 Vault Writer (Bulk Scope)

**Pre-filter phase (no I/O):**
1. Collect target files — `Vault.recurseChildren()` for folder, `vault.getMarkdownFiles()` for vault
2. Exclude ignored folders (prefix match from settings)
3. For each file: get `cache.links` and `cache.sections`, filter, resolve aliases, run pipeline decisions
4. If zero rewrites needed for a file → skip entirely
5. Build plan: `Map<TFile, RewriteAction[]>`

**Execute phase (I/O only for files needing changes):**
1. Iterate the plan asynchronously
2. For each file: `vault.process(file, (content) => { ... })`
   - Verify each `original` at expected offset in actual content
   - If mismatch → skip that link (cache stale, safe failure)
   - Apply rewrites in reverse offset order
   - If no rewrites applied after verification → return content unchanged
3. Yield to UI periodically (every 50–100 files) to avoid blocking
4. Summary notice: "X files processed, Y links updated, Z skipped"

## 5 Commands & Context Menus

| Command | Scope | Execution path | Context menu |
|---|---|---|---|
| Update link under cursor | Single link | Editor Writer | Editor right-click |
| Update all links in file | All links in active file | Editor Writer | — |
| Update all links in folder | Recursive folder | Vault Writer | File explorer right-click |
| Update all links in vault | Entire vault | Vault Writer | — |

- Cursor and file commands: registered as editor commands via `editorCallback` / `editorCheckCallback`
- Folder command: registered on `file-menu` workspace event with folder type check
- Vault command: registered as a standard command (command palette only)

## 6 Settings

```typescript
interface AliasHubSettings {
  overwriteExisting: boolean;
  ignoredFolders: string[];
}

const DEFAULT_SETTINGS: AliasHubSettings = {
  overwriteExisting: false,
  ignoredFolders: [],
};
```

- Managed via standard `PluginSettingTab` in Obsidian settings
- Persisted via `loadData()` / `saveData()` (`data.json` in plugin folder)
- Defaults merged on load — new fields in future versions don't break existing config
- `overwriteExisting`: toggle with description
- `ignoredFolders`: editable list (add/remove), paths relative to vault root, prefix-matched

## 7 Reporting

| Scope | Success | Nothing to do | Error/edge |
|---|---|---|---|
| Cursor | "Link updated: Alias" | "Link already up to date" / "No alias found for target" | "No wikilink under cursor" |
| File | "X links updated, Y skipped" | "No links to update" | — |
| Folder | "X files — Y links updated, Z skipped" | "No links to update in Folder" | "No markdown files found" |
| Vault | "X files — Y links updated, Z skipped" | "No links to update in vault" | — |

All via Obsidian `Notice` API. Brief, non-blocking, auto-dismiss. No modals. Skip reasons not surfaced in notices — reserved for future audit feature.

## 8 Module Structure

```
src/
  main.ts              # Plugin lifecycle, command registration, context menus
  settings.ts          # Settings interface, defaults, SettingTab
  pipeline.ts          # Core decision logic (pure, no Obsidian deps)
  alias-resolver.ts    # Alias lookup via metadataCache
  link-filter.ts       # Section filtering (yaml/code) + inline code detection
  editor-writer.ts     # Editor API rewrite path (cursor, file)
  vault-writer.ts      # vault.process() rewrite path (folder, vault)
```

**Dependency flow:**
- `main.ts` → everything (wiring)
- `editor-writer.ts` → `pipeline`, `alias-resolver`, `link-filter`
- `vault-writer.ts` → `pipeline`, `alias-resolver`, `link-filter`
- `pipeline.ts` → nothing (pure functions, zero Obsidian imports)
- `alias-resolver.ts` → Obsidian API only
- `link-filter.ts` → Obsidian types for positions, logic is pure offset comparison

**Testability:**
- `pipeline.ts` and `link-filter.ts`: fully unit-testable, no mocks needed
- `alias-resolver.ts`: thin metadataCache mock
- Writers: integration-tested via Obsidian CLI dev cycle (`plugin:reload`, `dev:errors`)

## 9 Code Quality

- TypeScript strict mode, no `any` except where Obsidian API forces it
- ESLint with standard TypeScript config
- JSDoc on all public functions
- Unit tests for `pipeline.ts` and `link-filter.ts` (pure logic)
- Follow JS/TS best practices: small focused functions, explicit types, early returns, no mutation of inputs, named constants over magic values

## 10 Key API Surface

| API | Used for |
|---|---|
| `metadataCache.getFileCache(file)` | Link positions, sections, frontmatter |
| `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` | Resolve link targets |
| `parseFrontMatterAliases(frontmatter)` | Extract aliases from frontmatter |
| `parseLinktext(text)` | Separate path from `#heading` / `#^block-id` |
| `vault.process(file, fn)` | Atomic file read-modify-write |
| `vault.getMarkdownFiles()` | All markdown files for vault-wide scope |
| `Vault.recurseChildren(folder, fn)` | Folder recursion |
| `editor.replaceRange(text, from, to)` | Live editor rewrites |
| `editor.getValue()` | Raw content for inline code detection |
| Workspace `file-menu` / `editor-menu` events | Context menus |

## 11 Important Implementation Notes

- **`displayText` is always populated in cache** — even `[[file]]` without a `|` has `displayText: "file"`. Must check `original` for `|` to determine if display text is explicit.
- **Reverse offset order** — when applying multiple rewrites to the same content, work backwards so earlier offsets remain valid.
- **Cache staleness** — vault.process callback verifies `original` at expected offset. Mismatch = skip (safe failure), not corrupt.
- **Yield in bulk** — `await sleep(0)` or similar every 50–100 files during vault-wide operations to keep UI responsive.
- **Ignored folder matching** — prefix-based: ignoring `_meta` also ignores `_meta/templates`.

## 12 Out of Scope (v1)

- Alias generation, audit, sync, reverse sync
- Markdown-style links, embeds
- Live/on-type updating, on-save hooks
- Ribbon icons, status bar indicators
- `title` frontmatter field as alias source

## 13 Extensibility Hooks

Architecture supports future features without structural changes:

- **Alias resolution** is behind a function boundary — swap in `title` field, H1-based, or AI-generated aliases by changing `alias-resolver.ts`
- **Pipeline decisions** are pure — add new skip/rewrite conditions without touching I/O
- **Scope machinery** (file collection, pre-filtering, bulk execution) is generic over the pipeline — future operations (strip display text, audit stale aliases) reuse the same scope layer
- **Settings** use defaults-merge pattern — add fields without breaking existing saved config
