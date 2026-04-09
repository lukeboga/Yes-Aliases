# Yes Aliases

An Obsidian plugin for the complete alias lifecycle of wikilinks: pull, push, compress, remove. Built for vaults with ID-style filenames where the raw filename is unreadable.

## What it does

Obsidian wikilinks default to showing the raw filename, which for timestamped or ID-based naming schemes (`20240315-mtg`, `2026-04-02-1430-00000`) is unreadable. Yes Aliases manages the display text of those links across four operations:

- **Pull** — update a link's display text to match the target note's `aliases[0]` (`[[20240315-mtg]]` → `[[20240315-mtg|Q1 review]]`)
- **Push (propagate)** — when a target note's alias changes, propagate the new value outward to every backlink across the vault
- **Compress** — trim a note's `aliases` array while protecting backlinks from being orphaned
- **Remove** — strip display text from links (the inverse of pull)

Each command operates at one or more scope levels — cursor, file, folder, vault — depending on what's semantically meaningful.

## Features

**Alias lifecycle commands**
- **Pull** — update link display text to match the target note's alias
- **Push** — propagate a target's alias change outward to backlinks across the vault
- **Compress** — trim a note's `aliases` array while protecting backlinks from orphaning
- **Remove** — strip display text from links (inverse of pull)

**Scope levels** — cursor, file, folder, vault (where semantically meaningful)

**Automatic updates** — opt-in: auto-propagate when a new note gets its first alias (on by default), or whenever any note's alias changes (off by default)

**Inclusive link coverage** — all markdown-target wikilinks and embeds participate, including headings and block references. Opt-out via one setting for users who prefer Obsidian's native anchor rendering.

## How propagate and remove stay safe

Both commands only touch display text that matches an entry in the target note's `aliases` array (current or historical). Prose display text like `[[Note|click here to read more]]` is always preserved — "click here to read more" isn't an alias of the target, so the plugin leaves it alone.

This is why keeping historical aliases in the array matters: when you change a note's canonical alias from "Old Name" to "New Name", leave "Old Name" as `aliases[1]` and the plugin can recognize and migrate any remaining backlinks that still show "Old Name". Once migration is complete, use "Compress aliases" to trim the historical entries.

## A note for users with descriptive filenames

By default, the plugin rewrites heading links (`[[Note#Heading]]`) and block references (`[[Note#^block-id]]`) to show the target's alias. This is the right default for ID-style filenames (e.g. `20240315-mtg`), where Obsidian's built-in `Note > Heading` rendering is hard to read.

If your filenames are already descriptive, you may prefer Obsidian's native rendering. Enable "Preserve heading and block anchors" in the plugin settings to skip anchored variants.

## Commands

### Pull (update display text from alias)

| Command | Scope | Access |
| --- | --- | --- |
| Update link under cursor | Single link at cursor | Command palette |
| Update link alias | Single link (body or source-mode YAML); all frontmatter links to target (Properties UI) | Right-click a wikilink |
| Update all links in current file | All links in active file | Command palette |
| Update all links in folder | All files in folder (recursive) | File explorer context menu |
| Update all links in vault | All files in vault | Command palette |

### Push (propagate a target's alias outward)

| Command | Scope | Access |
| --- | --- | --- |
| Propagate aliases for current file | Backlinks to the active file | Command palette |
| Propagate aliases for files in folder | Backlinks to every file in folder (recursive) | File explorer context menu |
| Propagate aliases across vault | Backlinks to every file in vault | Command palette |

### Compress (trim the `aliases` array)

| Command | Scope | Access |
| --- | --- | --- |
| Compress aliases in current file | Active file — keeps "Main aliases to keep" leading entries | Command palette |
| Compress aliases to main alias | Active file — always trims to 1 | Command palette |

If any backlink in the vault still shows an alias that compress would remove, the plugin refuses (or warns, depending on settings) so the link doesn't become orphaned.

### Remove (strip display text)

| Command | Scope | Access |
| --- | --- | --- |
| Remove link alias under cursor | Single link at cursor | Command palette |
| Remove link alias | Single link (body or source-mode YAML); all frontmatter links to target (Properties UI) | Right-click a wikilink |
| Remove link aliases in current file | All links in active file | Command palette |
| Remove link aliases in folder | All files in folder (recursive) | File explorer context menu |
| Remove link aliases in vault | All files in vault | Command palette |

## Settings

### General

| Setting | Default | Description |
| --- | --- | --- |
| Overwrite existing display text | Off | When enabled, links that already have display text get their text replaced with the target note's alias. When disabled, links with display text are left alone. |
| Update frontmatter links | On | When enabled, wikilinks inside frontmatter properties are included in alias updates. When disabled, only links in the note body are updated. |
| Preserve heading and block anchors | Off | When enabled, links to a specific heading or block (`[[Note#Heading]]`, `[[Note#^block-id]]`) are left alone. Obsidian's built-in rendering is used instead of the note's alias. Turn this on if your filenames are already descriptive. |
| Match aliases regardless of letter case | Off | When enabled, a link showing "foo bar" matches an alias "Foo Bar" and gets rewritten to the alias's exact casing. Helps clean up casing drift. |

### Automatic updates

| Setting | Default | Description |
| --- | --- | --- |
| Auto-update links when a new note gets its first alias | On | When you create a new note and give it an alias, links to that note in other notes are updated automatically. Only affects notes created during the current Obsidian session. |
| Auto-update links whenever any note's alias changes | Off | When you change a note's alias, links to that note are updated automatically. ⚠ Can touch many files at once — leave off until you've tried the manual "Propagate aliases" commands first. |
| Quiet mode: only notify on larger updates | 5 | When automatic updates touch this many files or fewer, no notice is shown. Set to 0 to always show a notice. |

### Compress aliases

| Setting | Default | Description |
| --- | --- | --- |
| Main aliases to keep | 1 | When you run "Compress aliases in current file", this many leading entries of the `aliases` array are kept and the rest are removed. The "Compress aliases to main alias" command always trims to 1 regardless. |
| Warn instead of blocking when compress would orphan links | Off | When enabled, the plugin shows a warning dialog instead of refusing when compress would orphan links. ⚠ Compressing with orphans strands those links — leave off unless you know what you're doing. |

### Remove link aliases

| Setting | Default | Description |
| --- | --- | --- |
| Remove also strips custom display text | Off | When enabled, remove strips display text from every link, including custom prose text. ⚠ Destroys intentional custom display text — the default is strongly recommended. |

### Ignored folders

| Setting | Default | Description |
| --- | --- | --- |
| Ignored folders | (empty) | Folder paths excluded from folder and vault-wide operations. One per line. Prefix-matched (so `_meta` also excludes `_meta/templates`). |

## Installation

**Community plugins:** Search "Yes Aliases" in Settings → Community plugins. *(Not yet available — pending community submission.)*

**Manual:** Download `main.js` and `manifest.json` from the [latest release](https://github.com/lukeboga/yes-aliases/releases/latest). Create a folder `yes-aliases` in your vault's `.obsidian/plugins/` directory. Copy both files into it. Enable the plugin in Settings → Community plugins.

## Compatibility

Requires Obsidian 1.0.0 or later. Works on desktop and mobile.

## Skip behavior

The plugin skips the following and leaves them unchanged:

- Broken links (target file does not exist)
- Files with no aliases in frontmatter
- Links inside code blocks or inline code
- Links with existing display text (when "Overwrite existing display text" is off)
- Frontmatter links (when "Update frontmatter links" is off)
- Heading and block references (when "Preserve heading and block anchors" is on)

## Known limitations

**Right-clicking a frontmatter wikilink in the Properties UI updates every frontmatter link to that target, not just the clicked one.** If a note has multiple frontmatter wikilinks pointing to the same target file (e.g. the same target listed twice in a `links` property), right-clicking any of them and selecting "Update link alias" or "Remove link alias" rewrites all of them in one operation. Body links to the same target are not affected.

This is because Obsidian's `link-context-menu` event reports only the target file, not which property field was clicked. There is no public way to map the right-click back to a specific frontmatter link occurrence. Per-link semantics still work for body links (they use the cursor position) and for source-mode YAML wikilinks (they use the click coordinates). Use the "Update link under cursor" command in source mode if you need to update a single specific frontmatter link.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE).
