# Changelog

All notable changes to Yes Aliases are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

For older entries, see [changelog archive](changelog/archive/).

## [Unreleased]

### Added
- Alias propagation commands: "Propagate aliases for current file" and "Propagate aliases across vault" (palette), "Propagate aliases for files in folder" (file explorer context menu)
- Automatic alias propagation: opt-in tier for new notes (on by default, narrow scope via in-memory recently-created set) and broader tier for any alias change (off by default, broad scope via alias snapshot diff)
- Compress commands: "Compress aliases in current file" (respects "Main aliases to keep" setting) and "Compress aliases to main alias" (always trims to 1)
- Compress backlink interlock: strict refuse by default, optional warn-and-confirm modal that lists up to 5 stripped alias entries inline
- Remove link alias commands: cursor, file, folder, and vault scopes
- Context menu integration for remove: editor-menu (source-mode YAML), file-menu link-context-menu (body links and Properties UI), folder file-menu
- Eight new settings: preserve heading and block anchors, match aliases regardless of letter case, auto-update on new-note alias, auto-update on any alias change, quiet mode notice threshold, main aliases to keep, compress warn-instead-of-blocking, remove also strips custom display text
- Grouped settings tab with five sections (general, automatic updates, compress aliases, remove link aliases, ignored folders) and plain-English labels
- Frontmatter link support — alias propagation for wikilinks inside frontmatter properties (all scopes: cursor, file, folder, vault)
- "Update link alias" right-click action for body wikilinks (any mode), source-mode YAML wikilinks, and Properties UI links in Live Preview
- `updateFrontmatterLinks` setting (default: on) to toggle frontmatter link processing
- Manual testing guide (`docs/manual-testing.md`)
- Memory footprint regression test for `aliasSnapshot` against a synthetic 10k-note distribution
- README rewrite for the v0.1.0 feature set with safe-rewrite rule explanation, full settings reference, and a note for users with descriptive filenames

### Changed
- Link-type boundary rules are now inclusive by default: heading links, block references, and embeds (plain, captioned, heading, block) all participate in pull, push, and remove operations. Enable "Preserve heading and block anchors" in settings to restore Obsidian's native anchor rendering for heading and block variants.
- Migrate from multi-plugin monorepo to single-plugin release structure
- Rename from "Aliases Hub" to "Yes Aliases"
- Replace deny-all .gitignore with standard ignores
- Move dev vault to external path via .env configuration

### Fixed
- Frontmatter wikilinks no longer silently fail to rewrite in Live Preview mode. Affects pull-update ("Update all links in current file"), remove ("Remove link aliases in current file"), and the Properties UI right-click fallbacks for both. All frontmatter rewrites now route through `vault.process` regardless of editor mode; the editor view auto-syncs from disk
- Alias resolution now handles `alias` (singular) frontmatter key via `parseFrontMatterStringArray` fallback
- "Update link under cursor" notice now says "Skipped — display text already set" instead of misleading "Link already up to date" when a link has existing display text and overwrite is off
