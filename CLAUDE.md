# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file must be kept up to date as project scope and requirements change.**

## Project Overview

Development repo for the **MakoNP** Obsidian vault. The vault at `./MakoNP-Test/` is a testing clone of the live vault used for plugin development. The goal is to create focused Obsidian plugins that serve the vault's PKM workflow, including its custom note-tagging system (ntags), task management, bookmarks, events, and Obsidian Bases integration.

### Planned Plugins

- **Aliases Hub** — (first plugin, details TBD)
- More to follow based on vault requirements

### Project-Level Skills

- `obsidian-skills` (kepano) — reference for Obsidian plugin patterns
- `superpowers` (obra) — reference for advanced plugin capabilities

## Vault Structure (`./MakoNP-Test/`)

```
MakoNP-Test/
  notes/          # All notes (timestamped + daily notes)
  ntag/
    type/         # NTag type definitions (%Note, %Task/Basic, etc.)
    stack/        # NTag stack/context definitions (+MakoNP, etc.)
    theme/        # Reserved for future use
  _meta/
    templates/
      full/       # Complete note templates (Daily-Note, _Note, NTag, Task.Basic, Task.Full, View)
      partial/    # Snippet templates (Log-Link)
    assets/       # Attachments
    obsidian.vimrc
```

## NTag System

NTags are the vault's custom categorization system, stored as notes with frontmatter. Two dimensions:

- **Types** (`ntag/type/`) — Note classification. Alias prefix: `%` (e.g., `%Note`, `%Task/Full`, `%DailyNote`, `%View`)
- **Stacks** (`ntag/stack/`) — Context/project grouping. Alias prefix: `+` (e.g., `+MakoNP`)

Type references in frontmatter use absolute wiki-links: `type: "[[ntag/type/task.full|%Task/Full]]"`
Stack references: `context: "[[ntag/stack/mako-np|+MakoNP]]"`

All notes have an `ntags: []` field reserved for tagging.

## Frontmatter Conventions

**Universal fields:** `aliases`, `created`, `modified`, `ntags`, `type`

**Task.Full additions:** `status` (pending/in_progress/completed), `closed` (checkbox), `due_date`, `due_time`, `scheduled_date`, `scheduled_time`, `duration`, `priority` (format: `LEVEL-NAME`, e.g., `2-med`)

**View additions:** `context` (stack reference)

## Note Naming

- **Timestamped notes:** `YYYY-MM-DD-HHmm-ssSSS.md` (ZK Prefixer format, millisecond precision)
- **Daily notes:** `YYYY-MM-DD.md`
- All notes live in `notes/`

## Obsidian Config Highlights

- Vim mode enabled (custom vimrc at `_meta/obsidian.vimrc`)
- Link format: absolute paths, auto-updated on move
- New notes go to `notes/` folder
- Templates folder: `_meta/templates`
- Installed community plugin: `obsidian-vimrc-support`
- Core plugins of note: `bases`, `daily-notes`, `templates`, `zk-prefixer`, `bookmarks`
- `_meta/` is hidden from vault UI via user ignore filters

## Plugin Development

Obsidian plugins are TypeScript projects. Standard structure:

```
plugin-name/
  src/
    main.ts       # Plugin entry point (extends Plugin)
  manifest.json   # Plugin metadata (id, name, version, minAppVersion)
  install.mjs     # Copies built files to build/ and dev vault
  package.json
  tsconfig.json
  esbuild.config.mjs
```

### Build & Install

`npm run install:vault` (from a plugin directory) does three things:
1. Type-checks and bundles the plugin (`tsc` + `esbuild`)
2. Copies `main.js` + `manifest.json` to `build/<plugin-id>/` — portable output for any vault
3. Copies the same files to `MakoNP-Test/.obsidian/plugins/<plugin-id>/` (dev vault)

To install in a live vault, copy `build/<plugin-id>/` into `<vault>/.obsidian/plugins/<plugin-id>/`.

Each plugin needs at minimum: `manifest.json`, `main.js`, and optionally `styles.css`.

### Build Commands (per plugin)

```sh
cd plugins/<plugin-name>
npm install
npm run dev           # watch mode
npm run build         # production build (type-check + bundle)
npm run install:vault # build + copy to build/ and dev vault
```

## Handoff Protocol

Cross-session continuity system. Two layers: **persistent state** (survives indefinitely) and **session handoffs** (immediate context transfer).

### Persistent State — `project/state.md`

Single source of truth for project-wide status. Contains:
- **Active Work** — what's in progress, current focus
- **Decisions Log** — dated record of architectural/design choices
- **Architecture Decisions** — rationale for non-obvious structural choices
- **Known Issues / Blockers** — unresolved problems
- **Plugin Status** — table tracking each plugin's lifecycle

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
> [paste-ready prompt for the next session — see rules below]
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

## Changelog — `changelog/`

Rolling log of project changes. Reverse chronological order.

- **`changelog/CHANGELOG.md`** — active changelog, 4–8 items
  - 4 = minimum before archiving is considered
  - 8 = hard limit; archive immediately at natural seam or when limit is hit
- **`changelog/archive/YYYY-MM.md`** — monthly archive files, items batched and moved here
- Each item: `- YYYY-MM-DD: <concise description of what changed and why>`
- Archive at a natural seam (end of feature, milestone, sprint) or when hitting 8 items
- When archiving: move oldest items to the appropriate `changelog/archive/YYYY-MM.md`, keep the most recent items in `CHANGELOG.md`
- Update changelog with every commit

## End-of-Session Git Commit

Commit all tracked changes at the end of every session. Rules:

- **Subject line**: imperative mood, max 50 chars, no period (e.g., `Add handoff protocol to CLAUDE.md`)
- **Body** (after blank line): bullet list of what changed and why; wrap at 72 chars
- Scope the subject to the most significant change; use body for the rest
- If the session touched multiple unrelated areas, prefer multiple focused commits over one sprawling commit
- Stage specific files — never `git add -A` or `git add .`
- Update `changelog/CHANGELOG.md` before committing

## .gitignore Policy

This repo uses a deny-all `.gitignore` (`*`) with an explicit allowlist. New top-level directories or files will not be tracked until added as exceptions.

- When creating a new top-level dir or file that should be tracked, add `!path/` and `!path/**` (for dirs) or `!filename` (for files) to `.gitignore`
- Flag to the user when a new `.gitignore` exception is needed
- Exceptions are added incrementally as the project grows — do not pre-add paths speculatively

## Key Principles

- Each plugin should have a single, well-defined focus
- Plugins must respect the existing ntag system and frontmatter conventions
- Use absolute wiki-link format (`[[path/to/note|Alias]]`) when generating links
- Preserve the `%` prefix for type aliases and `+` prefix for stack aliases
- Templates use Obsidian core Templater syntax: `{{date:FORMAT}}`, `{{time:FORMAT}}` with moment.js tokens
