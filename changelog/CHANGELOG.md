# Changelog

- 2026-04-02: Wire commands and context menus — 3 palette commands (cursor/file/vault) and 2 context menus (editor/folder) in main.ts
- 2026-04-02: Add alias resolver — `resolveAlias` wraps metadataCache lookup and frontmatter alias extraction
- 2026-04-02: Add link filter — `isInsideSection`, `isInsideInlineCode`, `isEmbed` with 12 passing TDD tests; Obsidian-typed helpers in same module
- 2026-04-02: Tighten `SkipReason` to named union type; add 6 direct `extractLinkPath` tests (15 total passing)
- 2026-04-02: Add core pipeline — `decideRewrite` and `extractLinkPath` with 9 passing TDD tests
- 2026-04-02: Add settings module — `AliasHubSettings` interface, `AliasHubSettingTab`, overwrite toggle and ignored folders controls
- 2026-04-02: Scaffold aliases-hub plugin — build tooling, tsconfig, eslint, minimal main.ts compiles and lints clean
