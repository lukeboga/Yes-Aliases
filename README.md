# Yes Aliases

An Obsidian plugin that updates wiki-link display text using the target note's first alias.

## What it does

Obsidian wiki-links default to showing the raw filename, which for timestamped or ID-based naming schemes is unreadable. Yes Aliases resolves each link's target, reads `aliases[0]` from its frontmatter, and sets that as the link's display text. A link like `[[2026-04-02-1430-00000]]` becomes `[[2026-04-02-1430-00000|My Descriptive Alias]]`. This works on a single link, a file, a folder, or the entire vault.

## Commands

| Command | Scope | Access |
| --- | --- | --- |
| Update link under cursor | Single link at cursor | Command palette, editor context menu |
| Update all links in current file | All links in active file | Command palette |
| Update all links in folder | All files in folder (recursive) | File explorer context menu |
| Update all links in vault | All files in vault | Command palette |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Overwrite existing display text | Off | When off, links with existing display text are skipped. When on, existing display text is replaced with the alias. |
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
- Links inside frontmatter
- Links with existing display text (when "Overwrite existing display text" is off)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

Apache 2.0 — see [LICENSE](LICENSE).
