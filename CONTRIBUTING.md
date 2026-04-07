# Contributing to Yes Aliases

Yes Aliases is a single-purpose Obsidian plugin that propagates `aliases[0]` from target file frontmatter into wikilink display text. This document covers development setup, architecture, and conventions.

## Dev Setup

```
git clone https://github.com/lukeboga/yes-aliases.git
cd yes-aliases
npm install
```

### .env Configuration

Create a `.env` file in the repo root with the path to your dev vault:

```
OBSIDIAN_VAULT_PATH=/path/to/your/obsidian/vault
```

This is required for `npm run install:vault` to copy built files into the vault's plugin directory.

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Watch mode (rebuild on change) |
| `npm run build` | Type-check + production bundle |
| `npm run install:vault` | Build + copy to dev vault (requires .env) |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Watch mode tests |
| `npm run lint` | ESLint |

## Architecture

Split strategy: two execution paths sharing a pure decision pipeline.

- **Editor path** (cursor, file scope): Uses Obsidian Editor API. `editor.replaceRange()` for surgical, undo-friendly updates. No file I/O.
- **Vault path** (folder, vault scope): Cache-first pre-filtering via `metadataCache` (no I/O for files that don't need changes), then `vault.process()` for atomic writes. Yields to UI every 50 files.
- **Pipeline** (shared): Pure decision logic. Input: link text, display text, alias, settings. Output: skip (with reason) or rewrite (with new text). No Obsidian imports.

### Dependency Flow

```
main.ts → all modules (wiring)
editor-writer.ts → pipeline, alias-resolver, link-filter
vault-writer.ts → pipeline, alias-resolver, link-filter
pipeline.ts → nothing (pure)
alias-resolver.ts → Obsidian API only
link-filter.ts → pipeline (for extractLinkPath), Obsidian types
```

## Module Reference

| File | Responsibility |
|---|---|
| `src/main.ts` | Plugin lifecycle, command registration, context menus |
| `src/settings.ts` | Settings interface, defaults, settings tab UI |
| `src/pipeline.ts` | Pure decision logic -- no Obsidian imports |
| `src/alias-resolver.ts` | Alias lookup via metadataCache + parseFrontMatterAliases |
| `src/link-filter.ts` | Section/inline code/embed filtering by offset ranges |
| `src/editor-writer.ts` | Editor API rewrite path (cursor, file scope) |
| `src/vault-writer.ts` | vault.process() rewrite path (folder, vault scope) |

## Testing

- `pipeline.ts` and `link-filter.ts` are pure functions -- fully unit-testable, no mocks needed.
- Run: `npm test` or `npm run test:watch`.
- New test files go in `tests/`, named `<module>.test.ts`.
- Writers are integration-tested via Obsidian directly: reload plugin, verify behavior, check dev console for errors.

## Code Style

- TypeScript strict mode (`"strict": true` in tsconfig).
- No `any` except where Obsidian API forces it.
- ESLint with `eslint-plugin-obsidianmd` for Obsidian-specific rules.
- JSDoc on all exported functions.
- Sentence case for all user-facing text (command names, settings labels, notices).

## Obsidian API Rules

These come from `eslint-plugin-obsidianmd` and Obsidian's plugin guidelines:

- **Active file edits**: Use Editor API (`editor.replaceRange()`), not `Vault.modify()`.
- **Background file modifications**: Use `Vault.process()`, not `Vault.modify()`.
- **User-provided paths**: Always pass through `normalizePath()`.
- **Network requests**: Use `requestUrl()`, not `fetch()`.
- **Event listeners**: Register via `this.registerEvent()` for automatic cleanup on unload.
- **DOM manipulation**: Use Obsidian helpers (`createDiv()`, `createEl()`), never `innerHTML`/`outerHTML`.
- **Platform detection**: Use `Platform` API, not `navigator.platform`/`userAgent`.
- **Regex**: No lookbehind assertions (incompatible with iOS < 16.4).
- **Command naming**: No "command" in names/IDs, no plugin name/ID in command IDs.
- **Hotkeys**: Never set default hotkeys -- let users configure their own.
- **Settings headings**: Use `.setHeading()`, not manual HTML headings.

## Accessibility

Mandatory for any UI additions beyond the settings tab:

- All interactive elements must be keyboard accessible (Tab, Enter, Space).
- ARIA labels on icon-only buttons (`aria-label` attribute).
- Focus indicators via `:focus-visible` with Obsidian CSS variables.
- Touch targets minimum 44x44px for mobile.
- Tooltips positioned with `data-tooltip-position` attribute.

## Adding Features

- **New alias sources** (e.g., `title` field, H1 heading): Modify `src/alias-resolver.ts`.
- **New skip/rewrite conditions**: Modify `src/pipeline.ts` (pure -- add tests first).
- **New scope operations** (e.g., "strip all display text"): Reuse bulk execution pattern in `src/vault-writer.ts`.
- **New settings**: Add field to `YesAliasesSettings` interface + default in `DEFAULT_SETTINGS`. Existing saved settings auto-merge via `Object.assign({}, defaults, saved)`.

## Release Process

1. If new Obsidian APIs were used, update `minAppVersion` in `manifest.json`.
2. Run `npm version patch|minor|major` -- automatically updates `manifest.json`, `versions.json`, creates commit + tag.
3. `git push && git push origin <tag>` -- triggers GitHub Actions release workflow.
4. Review draft release on GitHub, publish when ready.

## Submission Checklist

Before submitting to the Obsidian community plugins directory:

- [ ] `npx eslint .` -- zero errors
- [ ] `id` in manifest: no "obsidian", doesn't end with "plugin", lowercase + dashes only
- [ ] `name` in manifest: no "Obsidian", doesn't end with "Plugin"
- [ ] `description` in manifest: no "Obsidian", no "This plugin", ends with punctuation, under 250 chars
- [ ] LICENSE file present with correct copyright year and holder
- [ ] All sample/boilerplate code removed
- [ ] No `console.log` in onload/onunload
- [ ] Mobile tested (if not desktop-only)
- [ ] Keyboard accessibility verified for any custom UI

## minAppVersion Policy

The `minAppVersion` field in `manifest.json` declares the oldest Obsidian version that supports all APIs used by the plugin. Review it whenever new Obsidian API calls are added. Set it to the lowest version that provides all required APIs. Update before running `npm version`.
