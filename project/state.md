# Project State

Persistent state for the Yes Aliases plugin. Updated incrementally as work progresses.
**Read this file at session start. Update it when state changes.**

## Active Work

- Yes Aliases v0.1.0 — migration to single-plugin release structure complete
- All tests passing (28), lint clean, build working
- Dev vault at external path via `.env` + `node --env-file`
- Next: test plugin in dev vault via Obsidian, then community plugin submission

## Latest Handoff

`project/handoffs/2026-04-07-001.md`

## Decisions Log

- 2026-04-02: Project initialized; test vault at `./MakoNP-Test/` for plugin dev
- 2026-04-02: Installed `obsidian-skills` + `superpowers` as project-scoped Claude Code plugins
- 2026-04-02: Handoff protocol established (`project/handoffs/`, `project/state.md`)
- 2026-04-02: `.gitignore` deny-all strategy (later replaced)
- 2026-04-02: Changelog system added
- 2026-04-02: Planning directory structure: `project/planning/{requirements,designs,plans}/` with `0001-` indexing
- 2026-04-02: Aliases Hub design approved — split strategy: Editor API for live scope, cache-first vault.process for bulk scope
- 2026-04-07: Migrate from multi-plugin monorepo to single-plugin release structure. Rename aliases-hub → yes-aliases.
- 2026-04-07: Replace deny-all .gitignore with standard explicit ignores
- 2026-04-07: Move dev vault to external path, replace dotenv with Node --env-file
- 2026-04-07: Add release tooling: version-bump.mjs, versions.json, GitHub Actions release workflow
- 2026-04-07: Bump minAppVersion from 0.15.0 to 1.0.0
- 2026-04-07: License: Apache 2.0
- 2026-04-07: Changelog restructured to Keep a Changelog format at root + archive

## Architecture Decisions

- **Split strategy**: Editor API (`editor.replaceRange`) for cursor/file scope (instant, undo-friendly); cache-first pre-filtering + `vault.process()` for folder/vault scope (performance for 10k+ vaults). Shared pure pipeline for decision logic.
- **Obsidian API patterns**: Use `parseFrontMatterAliases` for alias extraction, `metadataCache` for all lookups (no raw file reads), `vault.process()` for atomic writes.
- **Dev vault**: External path via `.env` file with `OBSIDIAN_VAULT_PATH`, loaded by `node --env-file=.env` in install:vault script. No dotenv dependency.

## Known Issues / Blockers

- `isInsideInlineCode` edge cases with nested backtick patterns (low risk, current impl handles common cases)

## Plugin Status

| Plugin | Status | Notes |
|--------|--------|-------|
| Yes Aliases | v0.1.0 release-ready | 28 tests passing, lint clean, CI workflow in place |
