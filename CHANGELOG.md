# Changelog

All notable changes to Yes Aliases are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

For older entries, see [changelog archive](changelog/archive/).

## [Unreleased]

### Changed
- **Renamed "propagate" to "push" everywhere** — command names, IDs, settings keys, internal code, documentation. "Push aliases from file" / "Push aliases in vault" replace the former "Propagate" commands. Auto-push settings keys renamed accordingly (`autoPushNewNoteAliases`, `autoPushAllAliasChanges`, `autoPushNoticeThreshold`). No migration needed — v0.1.0 has not shipped
- **Command names normalized** to template `{Verb} link alias(es) {prep} {scope}` — dropped "current", normalized prepositions, singular for cursor scope, plural for batch scopes
- **Manifest description rewritten** to verb-led plain English per Obsidian submission requirements

### Fixed
- Bulk notice plural mismatches: "1 files — 1 links updated" now correctly shows "1 file — 1 link updated"
- Compress refuse notice: "still show" → "still shows" for singular link count
- Cursor update skip notice now distinguishes historical aliases from custom prose text and shows a migration hint: `Skipped — showing historical alias "Old". Run "Push aliases from file" to migrate to "New"`

## [0.1.0] - 2026-04-09

### Added
- Alias push commands: "Push aliases from file" and "Push aliases in vault" (palette), "Push aliases from folder" (file explorer context menu)
- Automatic alias push: opt-in tier for new notes (on by default, narrow scope via in-memory recently-created set) and broader tier for any alias change (off by default, broad scope via alias snapshot diff)
- Compress commands: "Compress aliases in file" (respects "Main aliases to keep" setting) and "Compress to main alias" (always trims to 1)
- Compress backlink interlock: strict refuse by default, optional warn-and-confirm modal that lists up to 5 stripped alias entries inline
- Remove link alias commands: cursor, file, folder, and vault scopes
- Context menu integration for remove: editor-menu (source-mode YAML), file-menu link-context-menu (body links and Properties UI), folder file-menu
- Eight new settings: preserve heading and block anchors, match aliases regardless of letter case, auto-update on new-note alias, auto-update on any alias change, quiet mode notice threshold, main aliases to keep, compress warn-instead-of-blocking, remove also strips custom display text
- Grouped settings tab with five sections (general, automatic updates, compress aliases, remove link aliases, ignored folders) and plain-English labels
- Frontmatter link support — alias push for wikilinks inside frontmatter properties (all scopes: cursor, file, folder, vault)
- "Update link alias" right-click action for body wikilinks (any mode), source-mode YAML wikilinks, and Properties UI links in Live Preview
- `updateFrontmatterLinks` setting (default: on) to toggle frontmatter link processing
- Manual testing guide (`docs/manual-testing.md`)
- Memory footprint regression test for `aliasSnapshot` against a synthetic 10k-note distribution
- README rewrite for the v0.1.0 feature set with safe-rewrite rule explanation, full settings reference, and a note for users with descriptive filenames

### Changed
- Link-type boundary rules are now inclusive by default for wikilinks: heading links and block references (`[[Note#Heading]]`, `[[Note#^block-id]]`) participate in pull, push, and remove operations. Enable "Preserve heading and block anchors" in settings to restore Obsidian's native anchor rendering for these variants.

### Known limitations
- **Embeds (`![[..]]`, `![[..#Heading]]`, `![[..#^block]]`, `![[..|Caption]]`) are not yet rewritten by any command.** The inclusive-boundary architecture is in place but the writers do not yet iterate the embed cache. Embed support is scheduled for v0.1.1; the "Preserve heading and block anchors" setting will then apply to heading and block embeds in addition to their wikilink counterparts. Tracked in `project/planning/backlog.md`.
- Migrate from multi-plugin monorepo to single-plugin release structure
- Rename from "Aliases Hub" to "Yes Aliases"
- Replace deny-all .gitignore with standard ignores
- Move dev vault to external path via .env configuration

### Fixed
- Auto-push no longer treats every pre-existing file as "recently created" at plugin load. The `vault.on('create')` listener is now deferred until after Obsidian's initial vault index completes, preventing unsolicited backlink rewrites when `autoPushNewNoteAliases` is enabled
- Frontmatter wikilinks no longer silently fail to rewrite in Live Preview mode. Affects pull-update ("Update all links in current file"), remove ("Remove link aliases in current file"), and the Properties UI right-click fallbacks for both. All frontmatter rewrites now route through `vault.process` regardless of editor mode; the editor view auto-syncs from disk
- Alias resolution now handles `alias` (singular) frontmatter key via `parseFrontMatterStringArray` fallback
- "Update link under cursor" notice now says "Skipped — display text already set" instead of misleading "Link already up to date" when a link has existing display text and overwrite is off
