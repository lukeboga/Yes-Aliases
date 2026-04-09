# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Yes Aliases** — a single-purpose Obsidian plugin. Propagates `aliases[0]` from target file frontmatter into wikilink display text. Four scope levels: cursor, file, folder, vault. Manual command-driven, no live/on-type updating.

## Quick Reference

| Command | Purpose |
|---|---|
| `npm run dev` | Watch mode |
| `npm run build` | Type-check + production bundle |
| `npm run install:vault` | Build + copy to dev vault (requires .env) |
| `npm test` | Run Vitest tests |
| `npm run lint` | ESLint |

Key paths: `src/` (plugin source), `tests/` (unit tests), `manifest.json` (plugin metadata).

## Dev Vault

Dev vault configured via `.env` file with `OBSIDIAN_VAULT_PATH=/path/to/vault`. The `.env` file is gitignored. `npm run install:vault` builds and copies `main.js` + `manifest.json` to the vault's plugin directory. See CONTRIBUTING.md for full setup.

## Architecture & Conventions

See CONTRIBUTING.md for architecture, module reference, code style, Obsidian API rules, accessibility requirements, and release process.

## Handoff Protocol

Cross-session continuity system. Two layers: **persistent state** (survives indefinitely) and **session handoffs** (immediate context transfer).

### Persistent State — `project/state.md`

Single source of truth for project-wide status. Contains:
- **Active Work** — what's in progress, current focus
- **Decisions Log** — dated record of architectural/design choices
- **Architecture Decisions** — rationale for non-obvious structural choices
- **Known Issues / Blockers** — unresolved problems

**Rules:**
- Read `project/state.md` at the start of every session
- Update it whenever state changes (new decisions, status shifts, blockers found/resolved)
- Never let session handoffs be the only place important state lives — promote to `state.md`

### Session Handoffs — `project/handoffs/`

Short-lived context bridges between consecutive sessions. One file per handoff.

**Filename:** `YYYY-MM-DD-NNN.md` (NNN = zero-padded sequence per day, e.g., `2026-04-02-001.md`)

**Template:**

```markdown
# Handoff — YYYY-MM-DD-NNN

## Context
- What was the session goal
- What session/branch this continues (if any)

## Completed
- Concrete deliverables, with file paths where relevant

## In Progress
- Unfinished work; current state of each item
- Include branch names, failing tests, partial implementations

## Next Steps
- Ordered list of what the next session should do first
- Flag anything that needs user input before proceeding

## Warnings
- Gotchas, traps, non-obvious coupling, fragile state
- Anything the next session could waste time on without this context

## Opening Prompt
~~~
[paste-ready prompt for the next session — see rules below]
~~~
```

**Opening Prompt rules:**
- Required when there is ongoing work; omit only if the session wrapped cleanly with nothing pending
- Placed last so the user can copy it directly without scrolling
- Must be a self-contained, paste-ready prompt — the next session receives no prior conversation context
- Structure: (1) orient — point to files to read first (CLAUDE.md is auto-loaded, never reference it), (2) state the goal, (3) specify the first concrete action
- Reference `project/state.md`, the handoff file, and any other essential reading by path — but not CLAUDE.md
- Include enough context that the next session can act without asking clarifying questions
- Be specific: name branches, files, functions, test commands — not "continue where we left off"
- Keep it concise but complete; one short paragraph or a tight numbered list

**Rules:**
- Create a handoff at session end when work is in progress or context would be lost
- Front-load the most decision-relevant info; compress ruthlessly but preserve nuance
- Use lists; avoid prose paragraphs
- Reference specific files, line numbers, function names — not vague descriptions
- After a handoff is consumed by the next session, it stays in `handoffs/` as history (do not delete)
- Anything with lasting relevance must also be written to `project/state.md`

### Writing Style (handoffs, state, changelog)

- High signal, low noise
- Lists over paragraphs
- Front-load: put the most important thing first in every section
- Compress sentences to the point just before meaning/nuance are lost
- Name files, paths, functions — never say "the main file" or "the config"
- Decisions need rationale, not just outcomes

## Changelog

- **`CHANGELOG.md`** at repo root — Keep a Changelog format, semver headings
- **`changelog/archive/`** — monthly archive files, linked from root changelog
- Update changelog with every commit
- Use Keep a Changelog categories: Added, Changed, Fixed, Removed
- Archive old release entries when the file gets long

## End-of-Session Git Commit

Commit all tracked changes at the end of every session. Rules:

- **Subject line**: imperative mood, max 50 chars, no period (e.g., `Add handoff protocol to CLAUDE.md`)
- **Body** (after blank line): bullet list of what changed and why; wrap at 72 chars
- Scope the subject to the most significant change; use body for the rest
- If the session touched multiple unrelated areas, prefer multiple focused commits over one sprawling commit
- Stage specific files — never `git add -A` or `git add .`
- Update `CHANGELOG.md` before committing

## Key Development Notes

- `minAppVersion` in `manifest.json` must be reviewed when new Obsidian APIs are added
- Command IDs must not contain the plugin name or "command"
- All UI text must use sentence case
- No default hotkeys
- `project/` is gitignored — dev continuity only, not visible to plugin users
