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

## Obsidian Skills (REQUIRED — invoke via the Skill tool)

The `obsidian-skills` plugin exposes specialized skills for working with Obsidian vaults and Obsidian Flavored Markdown. **These are the highest-leverage tooling for this project — use them whenever they apply, do not roll your own.** Skills override default behavior; check for an applicable skill BEFORE writing code, running CLI commands, or generating Obsidian-specific syntax.

| Skill | When to use | Why it matters here |
|---|---|---|
| `obsidian:obsidian-cli` | Any time you need to interact with the dev vault: reload the plugin after `install:vault`, capture runtime errors, execute JavaScript inside Obsidian, take screenshots, read/create/search notes, manage plugins or themes | The full plugin dev loop runs through this skill. `obsidian plugin:reload id=yes-aliases` and `obsidian dev:errors` are the canonical way to verify a runtime change. Phase 7 onward (and any manual testing) must use this skill — never instruct the user to reload by hand when the CLI can do it. |
| `obsidian:obsidian-markdown` | Writing or editing `.md` files that exercise Obsidian-specific syntax: wikilinks, embeds, callouts, frontmatter, tags, block refs, heading anchors | Test fixtures, README examples, manual-testing walkthroughs, and any narrative documentation that demonstrates plugin behavior must use correct Obsidian Flavored Markdown. Do not improvise wikilink or callout syntax. |
| `obsidian:obsidian-bases` | Anything involving `.base` files (database-like views) | Not currently used in this plugin's source, but the dev vault may contain Bases that need reading or editing. |
| `obsidian:json-canvas` | Anything involving `.canvas` files (visual canvases, mind maps, flowcharts) | Same — consult on demand if the dev vault contains canvases that interact with the plugin. |
| `obsidian:defuddle` | Reading any URL the user provides (online docs, blog posts, articles) | Use instead of `WebFetch` for general web pages — saves tokens and yields cleaner markdown. |

**Rule:** Per the superpowers `using-superpowers` skill, if there is even a 1% chance an Obsidian skill applies, invoke it via the `Skill` tool before acting. Do not paraphrase from memory and do not skip the skill because the task "feels simple" — the skills carry current syntax and CLI flag details that may have shifted since training.

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

### Multi-session plan execution

When a plan is large enough to span multiple sessions (rule of thumb: more than ~1500 lines, more than ~3 phases, or more than a single session of context), the handoff protocol is insufficient on its own — handoffs are transient and the next session will not re-read stale ones. Use these additional mechanisms:

**Session ledger at the top of the plan doc.**

Every multi-session plan must include a mutable status table near the top of the plan doc itself — not in a handoff, not in `state.md`. The ledger is the single source of truth for "where are we in this plan right now". Minimum columns:

| Phase | Scope | Status | Last commit | Tests | Handoff |

Status values: `not started` / `in-progress` / `verified` (phase verify gate passed) / `blocked` (with reason). Update the ledger at the end of every session that touches the plan. Read it at the start of every session. `verified` means the phase's verify gate (`npm test && npm run lint && npm run build`, plus reload/dev-errors for phases that add runtime surface) has passed cleanly.

**Baseline test count.**

Record the pre-implementation test count somewhere in the plan (usually in the ledger preamble). Any handoff reporting fewer tests than baseline indicates a regression that must be fixed before the next phase starts.

**Phase-boundary stop rule.**

Stop at phase verify gates, never mid-phase unless context forces it. Phase boundaries are verify-clean points; mid-phase stops leave the repo in an inconsistent state (failing tests, partial implementations, unreviewed code). If a mid-phase handoff is unavoidable, record the exact in-progress task number in the ledger's Status column (e.g., `in-progress: 3.2 step 3 of 6`) so the next session can resume at the right step.

**Single-file plan is the default.**

Resist splitting plans into phase files. Cross-phase type dependencies, global load-bearing constraints at the top of the plan, and holistic self-review traceability all become lossy at reference sites when split. Splitting is reasonable only when phases are genuinely independent (no shared types, no shared test files, no forward references) — and in that case they should probably be separate plans, not subfiles of one plan.

**End-of-session checklist (for multi-session plans):**

1. Run `npm test && npm run lint && npm run build` — confirm clean.
2. For phases that add runtime surface (command registration, event handlers, UI): also `npm run install:vault && obsidian plugin:reload id=<plugin-id> && obsidian dev:errors`.
3. Update the session ledger in the plan: phase status, last commit SHA, current test count, handoff filename.
4. Write a handoff under `project/handoffs/YYYY-MM-DD-NNN.md`. Treat the handoff as a **context bridge**, not a knowledge store — it carries session-specific outcome (what was done, what's in-progress, files touched) and points at durable locations for everything else.
5. Update `project/state.md` if a state-worthy decision was made. **Critical details and persistent state must not be buried in handoffs.** If something has lasting relevance beyond the immediate next session, it belongs in `state.md` (project-wide) or the plan itself (plan-scoped) — not only in the handoff.
6. Include a self-contained Opening Prompt at the end of the handoff.

**Start-of-session checklist (for multi-session plans):**

1. Read `project/state.md` (always first).
2. Read the plan doc's session ledger and load-bearing constraints (top of the plan). Load the specific phase to be worked in full; skim later phases.
3. Read the latest handoff named in `state.md`.
4. Confirm working tree is clean (`git status`).
5. Confirm test baseline (`npm test` matches the last handoff's recorded count).
6. Invoke the execution skill (`superpowers:executing-plans` or `superpowers:subagent-driven-development`) for the target phase.

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
