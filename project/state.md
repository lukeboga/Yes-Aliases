# Project State

Persistent state for the MakoNP-Dev project. Updated incrementally as work progresses.
**Read this file at session start. Update it when state changes.**

## Active Work

- Aliases Hub v0.1.0 complete and packaged, 28 tests passing
- Build workflow: `npm run install:vault` → `build/aliases-hub/` + dev vault
- Next: brainstorm/plan backlink alias propagation feature (auto-update links when new note gets an alias)

## Latest Handoff

`project/handoffs/2026-04-03-002.md`

## Decisions Log

- 2026-04-02: Project initialized; test vault at `./MakoNP-Test/` for plugin dev
- 2026-04-02: Installed `obsidian-skills` + `superpowers` as project-level Claude Code plugins (project scope only, `.claude/settings.json`)
- 2026-04-02: Handoff protocol established (`project/handoffs/`, `project/state.md`)
- 2026-04-02: `.gitignore` deny-all strategy — allowlist: `.gitignore`, `CLAUDE.md`, `project/`, `plugins/`, `changelog/`
- 2026-04-02: Changelog system added (`project/changelog/CHANGELOG.md`, 4–8 item rolling window, monthly archive)
- 2026-04-02: End-of-session git commit rules added to CLAUDE.md
- 2026-04-02: Planning directory structure: `project/planning/{requirements,designs,plans}/` with `0001-` indexing
- 2026-04-02: Aliases Hub design approved — split strategy: Editor API for live scope, cache-first vault.process for bulk scope

## Architecture Decisions

- **Aliases Hub split strategy**: Editor API (`editor.replaceRange`) for cursor/file scope (instant, undo-friendly); cache-first pre-filtering + `vault.process()` for folder/vault scope (performance for 10k+ vaults). Shared pure pipeline for decision logic.
- **Plugin worktree convention**: `.worktrees/` directory for isolated feature branches. Already gitignored by deny-all policy.
- **Obsidian API patterns**: Use `parseFrontMatterAliases` for alias extraction, `metadataCache` for all lookups (no raw file reads), `vault.process()` for atomic writes.

## Known Issues / Blockers

- `isInsideInlineCode` improvements noted in code review — edge cases with nested backtick patterns may still exist (low risk, current impl handles common cases)

## Plugin Status

| Plugin | Status | Location | Notes |
|--------|--------|----------|-------|
| Aliases Hub | v0.1.0 functional | `plugins/aliases-hub/` | Merged to main, 28 tests passing |
