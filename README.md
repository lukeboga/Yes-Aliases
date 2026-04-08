# Yes Aliases

An Obsidian plugin that updates wiki-link display text using the target note's first alias.

## What it does

Obsidian wiki-links default to showing the raw filename, which for timestamped or ID-based naming schemes is unreadable. Yes Aliases resolves each link's target, reads `aliases[0]` from its frontmatter, and sets that as the link's display text. A link like `[[2026-04-02-1430-00000]]` becomes `[[2026-04-02-1430-00000|My Descriptive Alias]]`. This works on a single link, a file, a folder, or the entire vault.

## Commands

| Command | Scope | Access |
| --- | --- | --- |
| Update link under cursor | Single link at cursor | Command palette |
| Update link alias | Single link (body or source-mode YAML); all frontmatter links to target (Properties UI) | Right-click a wikilink |
| Update all links in current file | All links in active file | Command palette |
| Update all links in folder | All files in folder (recursive) | File explorer context menu |
| Update all links in vault | All files in vault | Command palette |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Overwrite existing display text | Off | When off, links with existing display text are skipped. When on, existing display text is replaced with the alias. |
| Update frontmatter links | On | When on, wikilinks inside frontmatter properties are processed alongside body links. When off, only body links are updated. |
| Ignored folders | (empty) | Folder paths excluded from folder and vault-wide operations. Prefix-matched. |

## Installation

**Community plugins:** Search "Yes Aliases" in Settings → Community plugins. *(Not yet available — pending community submission.)*

**Manual:** Download `main.js` and `manifest.json` from the [latest release](https://github.com/lukeboga/yes-aliases/releases/latest). Create a folder `yes-aliases` in your vault's `.obsidian/plugins/` directory. Copy both files into it. Enable the plugin in Settings → Community plugins.

## Compatibility

Requires Obsidian 1.0.0 or later. Works on desktop and mobile.

## Skip behavior

The plugin skips the following and leaves them unchanged:

- Broken links (target file does not exist)
- Files with no aliases in frontmatter
- Embeds (`![[...]]`)
- Links inside code blocks or inline code
- Links with existing display text (when "Overwrite existing display text" is off)
- Frontmatter links (when "Update frontmatter links" is off)

## Known limitations

**Right-clicking a frontmatter wikilink in the Properties UI updates every frontmatter link to that target, not just the clicked one.** If a note has multiple frontmatter wikilinks pointing to the same target file (e.g. the same target listed twice in a `links` property), right-clicking any of them and selecting "Update link alias" rewrites all of them in one operation. Body links to the same target are not affected.

This is because Obsidian's `link-context-menu` event reports only the target file, not which property field was clicked. There is no public way to map the right-click back to a specific frontmatter link occurrence. Per-link semantics still work for body links (they use the cursor position) and for source-mode YAML wikilinks (they use the click coordinates). Use the "Update link under cursor" command in source mode if you need to update a single specific frontmatter link.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE).
