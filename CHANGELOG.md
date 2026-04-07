# Changelog

All notable changes to Yes Aliases are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [Semantic Versioning](https://semver.org/).

For older entries, see [changelog archive](changelog/archive/).

## [Unreleased]

### Fixed
- Alias resolution now handles `alias` (singular) frontmatter key via `parseFrontMatterStringArray` fallback
- "Update link under cursor" notice now says "Skipped — display text already set" instead of misleading "Link already up to date" when a link has existing display text and overwrite is off

### Added
- `FrontmatterRewrite` type and `applyFrontmatterRewrites` function in vault-writer for bounded YAML section string replacement
- Tests for `applyFrontmatterRewrites` (5 tests) — total: 51 tests
- `extractAliases` helper in alias-resolver for robust alias extraction from both `aliases` and `alias` keys
- `skipReasonMessage` helper in editor-writer for skip reason to notice message mapping
- Tests for alias extraction (4 tests) and skip reason messages (3 tests) — total: 35 tests
- `__mocks__/obsidian.ts` for Vitest mocking of Obsidian API functions
- Vitest config: `obsidian` module alias to mock for testability

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
