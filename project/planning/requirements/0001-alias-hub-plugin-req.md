# Obsidian Alias Hub -- Requirements Spec

## 1 Vision

A single-purpose Obsidian plugin centred on aliases -- the most underleveraged feature in Obsidian's linking model. No existing plugin focuses exclusively on the alias lifecycle: populating them, propagating them to links, keeping them in sync, and surfacing them across the vault.

This v1 delivers the first capability: propagating aliases from target files into wikilink display text. The architecture must support future alias-centric features (see section 7) without structural changes.

### 1.1 v1 Scope

Update wikilink display text to match the first `aliases` entry in the target file's YAML frontmatter.

**Before:** `[[abc-01-02-03-04]]`
**After:** `[[abc-01-02-03-04|My Descriptive Alias]]`

where `My Descriptive Alias` is `aliases[0]` in the frontmatter of file `abc-01-02-03-04.md`.

---

## 2 Definitions

| Term | Meaning |
|---|---|
| **Source file** | The file containing the wikilink being updated |
| **Target file** | The file the wikilink points to |
| **Display text** | The portion after `\|` in `[[target\|display text]]` |
| **Alias** | A value in the target file's YAML `aliases` array |

---

## 3 Functional Requirements

### 3.1 Core Behavior

- FR-01: For each wikilink in a source file, resolve the target file using `metadataCache.getFirstLinkpathDest`.
- FR-02: Read `aliases[0]` from the target file's cached frontmatter. Always the first alias. Not configurable.
- FR-03: If an alias exists, set the wikilink's display text to that alias.
- FR-04: If the wikilink already has display text matching `aliases[0]`, skip it (no-op).
- FR-05: If the target file has no `aliases` field, or the array is empty, skip the link.
- FR-06: If the target file cannot be resolved (broken link), skip the link.
- FR-07: Preserve heading and block references. `[[file#heading]]` becomes `[[file#heading|Alias]]`, not `[[file|Alias]]`.
- FR-08: Do not modify embed syntax (`![[file]]`). Only modify standard wikilinks.
- FR-09: Do not modify markdown-style links (`[text](file.md)`).
- FR-10: Do not modify links inside code blocks (inline or fenced) or inside YAML frontmatter.

### 3.2 Commands

Four commands, each applying the same core operation (3.1) at increasing scope. All four must be registered as Obsidian commands (available in the command palette). Commands 1 and 3 must also be accessible via context menus.

- FR-11: **Update link under cursor** -- Editor command. Also available in the editor right-click context menu. Updates only the single wikilink at the cursor position. If the cursor is not on a wikilink, show a notice and do nothing.
- FR-12: **Update all links in current file** -- Editor command. Updates all qualifying wikilinks in the active file.
- FR-13: **Update all links in folder** -- Command registered on the file explorer context menu for folders. Processes all `.md` files in the selected folder and its subfolders recursively.
- FR-14: **Update all links in vault** -- Command palette only. Processes every `.md` file in the vault (respecting ignored folders).

### 3.3 Settings

- FR-15: **Overwrite existing display text** -- Boolean (default: `false`). When `false`, links that already have any display text are skipped. When `true`, existing display text is replaced with the alias.
- FR-16: **Ignored folders** -- List of folder paths to exclude from folder-level and vault-wide operations.

### 3.4 Reporting

- FR-17: After a folder or vault-wide operation, display an Obsidian notice summarizing: files processed, links updated, links skipped.
- FR-18: For single-file and single-link operations, display a brief notice confirming the update or stating nothing was changed.

---

## 4 Non-Functional Requirements

### 4.1 Correctness

- NFR-01: Must not modify file content unless at least one link is actually changed (avoid touching `modified` timestamps unnecessarily).
- NFR-02: All alias lookups must use `metadataCache` (no raw file reads for frontmatter).

### 4.2 Performance

- NFR-03: Vault-wide and folder operations must use batched `vault.process()` or equivalent to minimize I/O.
- NFR-04: Large vault operations (10k+ files) must not block the UI. Use async iteration with appropriate yielding.

### 4.3 Compatibility

- NFR-05: Must work on both desktop and mobile Obsidian.
- NFR-06: No external dependencies beyond the Obsidian API.
- NFR-07: Target the minimum Obsidian API version that supports all required APIs. Document this in `manifest.json`.

### 4.4 Code Quality and Standards

- NFR-08: TypeScript strict mode. No `any` types except where the Obsidian API forces them.
- NFR-09: Follow the official Obsidian sample plugin structure and conventions.
- NFR-10: Separate concerns cleanly: command registration, link parsing/rewriting, alias resolution, and file I/O must be in distinct modules. Do not place all logic in `main.ts`.
- NFR-11: All public functions must have JSDoc comments.
- NFR-12: Use ESLint with a standard TypeScript config. Zero warnings in CI.
- NFR-13: Include unit tests for the core link-parsing and rewriting logic (the pure functions that do not depend on the Obsidian runtime).

### 4.5 Extensibility

- NFR-14: The core operation must be structured as a pipeline: **resolve link -> resolve alias -> rewrite link**. Each stage must be a separate, replaceable unit so future features can swap or extend individual stages without modifying the others.
- NFR-15: The alias resolution stage must be behind an interface/abstraction so that future alias sources (e.g. first H1, `title` field, AI-generated) can be added without changing callers.
- NFR-16: The scope/invocation layer (cursor, file, folder, vault) must be generic over the core operation so future operations (e.g. "strip all display text", "audit stale aliases") can reuse the same scope machinery.
- NFR-17: Settings must be managed through a typed settings interface that is easy to extend with new fields without breaking existing saved settings (forward-compatible defaults).

---

## 5 Out of Scope (v1)

- Modifying markdown-style links.
- Modifying embeds.
- Creating or modifying aliases in target files.
- Syncing display text back to frontmatter.
- Supporting `title` frontmatter field as an alias source.
- Bi-directional sync (keeping display text and aliases in sync over time).
- Live/on-type updating (all operations are explicit manual actions).
- Ribbon icons or status bar indicators.

---

## 6 Edge Cases

| Scenario | Expected behavior |
|---|---|
| `[[file#heading]]` | Becomes `[[file#heading\|Alias]]` |
| `[[file#^block-id]]` | Becomes `[[file#^block-id\|Alias]]` |
| `[[file\|existing text]]` with overwrite=false | Skipped |
| `[[file\|existing text]]` with overwrite=true | Becomes `[[file\|Alias]]` |
| `[[file\|Alias]]` (already correct) | Skipped (no file write) |
| `![[file]]` | Skipped |
| Target file has `aliases: []` | Skipped |
| Target file has no frontmatter | Skipped |
| Wikilink inside fenced code block | Skipped |
| Wikilink inside inline code | Skipped |
| Wikilink inside YAML frontmatter | Skipped |
| Target file is unresolved (broken link) | Skipped |
| Source file has no wikilinks | No-op, no notice needed |
| Cursor not on a wikilink (FR-11) | Notice: "No wikilink under cursor" |
| Folder contains 0 `.md` files | Notice: "No markdown files found" |

---

## 7 Future Roadmap (Not in v1 -- Architectural Awareness Only)

These features are out of scope for v1 but the architecture must not preclude them. They represent the broader vision of an alias-centric plugin.

- **Alias generation** -- Populate a target file's `aliases[0]` from its first H1 heading (similar to Linter's YAML Title Alias, but alias-first rather than YAML-first).
- **Alias audit** -- Surface files with no aliases, files with stale aliases (alias doesn't match H1), and links with display text that doesn't match any alias.
- **Bulk alias cleanup** -- Strip or normalize display text across the vault.
- **Alias from `title` field** -- Fall back to the `title` frontmatter property when `aliases` is absent.
- **Reverse sync** -- If a user manually sets display text on a link, offer to add that text as an alias on the target file.
- **On-save hook** -- Optionally run the link update operation when a file is saved (opt-in, not default).
