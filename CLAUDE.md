# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file must be kept up to date as project scope and requirements change.**

## Project Overview

Development repo for the **MakoNP** Obsidian vault. The vault at `./MakoNP/` is a copy of a live vault used for plugin development. The goal is to create focused Obsidian plugins that serve the vault's PKM workflow, including its custom note-tagging system (ntags), task management, bookmarks, events, and Obsidian Bases integration.

### Planned Plugins

- **Aliases Hub** — (first plugin, details TBD)
- More to follow based on vault requirements

### Project-Level Skills

- `obsidian-skills` (kepano) — reference for Obsidian plugin patterns
- `superpowers` (obra) — reference for advanced plugin capabilities

## Vault Structure (`./MakoNP/`)

```
MakoNP/
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
  package.json
  tsconfig.json
  esbuild.config.mjs  # or rollup.config.js
```

To install a dev plugin into the vault, symlink or copy the built output to:
`./MakoNP/.obsidian/plugins/<plugin-id>/`

Each plugin needs at minimum: `manifest.json`, `main.js`, and optionally `styles.css`.

### Build Commands (per plugin)

```sh
cd plugins/<plugin-name>
npm install
npm run dev    # watch mode
npm run build  # production build
```

## Key Principles

- Each plugin should have a single, well-defined focus
- Plugins must respect the existing ntag system and frontmatter conventions
- Use absolute wiki-link format (`[[path/to/note|Alias]]`) when generating links
- Preserve the `%` prefix for type aliases and `+` prefix for stack aliases
- Templates use Obsidian core Templater syntax: `{{date:FORMAT}}`, `{{time:FORMAT}}` with moment.js tokens
