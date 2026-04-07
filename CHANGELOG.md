# Changelog

All notable changes to Yes Aliases are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

For older entries, see [changelog archive](changelog/archive/).

## [Unreleased]

### Added
- Frontmatter link support — alias propagation for wikilinks inside frontmatter properties (all scopes: cursor, file, folder, vault)
- Properties UI context menu "Update link alias" for Live Preview mode (via `file-menu` `link-context-menu` event)
- `updateFrontmatterLinks` setting (default: on) to toggle frontmatter link processing
- Manual testing guide (`docs/manual-testing.md`)

### Fixed
- Alias resolution now handles `alias` (singular) frontmatter key via `parseFrontMatterStringArray` fallback
- "Update link under cursor" notice now says "Skipped — display text already set" instead of misleading "Link already up to date" when a link has existing display text and overwrite is off

### Changed
- Migrate from multi-plugin monorepo to single-plugin release structure
- Rename from "Aliases Hub" to "Yes Aliases"
- Replace deny-all .gitignore with standard ignores
- Move dev vault to external path via .env configuration

### Added
- README.md, CONTRIBUTING.md, LICENSE (Apache 2.0)
- GitHub Actions release workflow
- version-bump.mjs, versions.json for release management
- .editorconfig for formatting consistency
- vitest.config.ts

## [0.1.0] - 2026-04-03

### Added
- Propagate aliases into wikilink display text
- Four scope levels: cursor, file, folder, vault
- Settings: overwrite existing display text, ignored folders
- Context menus for cursor and folder operations
- 28 unit tests for pipeline and link-filter logic
