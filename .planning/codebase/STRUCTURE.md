# Codebase Structure

**Analysis Date:** 2026-04-14

## Directory Layout

```
obsidian-rollover-daily-todos/
├── src/                        # Source code for plugin
│   ├── index.js                # Main plugin class and entry point
│   ├── get-todos.js            # Todo parser logic
│   ├── get-todos.test.js       # Parser tests
│   └── ui/                      # UI components
│       ├── RolloverSettingTab.js # Settings configuration UI
│       └── UndoModal.js          # Undo confirmation modal
├── .planning/
│   └── codebase/               # Architecture documentation (this directory)
├── .vscode/                     # VS Code workspace settings
├── .github/                     # GitHub workflows
├── manifest.json               # Obsidian plugin metadata
├── package.json                # Node dependencies and scripts
├── rollup.config.js            # Build configuration
├── pnpm-lock.yaml              # Dependency lock file
├── LICENSE                     # MIT license
├── README.md                    # Plugin documentation
├── versions.json               # Plugin version history
├── demo.gif                    # Demo animation
└── main.js                     # Compiled plugin output (build artifact)
```

## Directory Purposes

**src/**
- Purpose: All source code for the plugin
- Contains: Plugin main class, parsing logic, UI components, tests
- Key files: `index.js` (entry point), `get-todos.js` (core parser)

**src/ui/**
- Purpose: Obsidian UI components and modals
- Contains: Settings tab and undo confirmation dialog
- Key files: `RolloverSettingTab.js`, `UndoModal.js`

**.planning/codebase/**
- Purpose: Architecture documentation files
- Contains: ARCHITECTURE.md, STRUCTURE.md, and other analysis docs
- Key files: Documents generated during codebase analysis

**.github/workflows/**
- Purpose: GitHub Actions CI/CD pipelines
- Contains: Automated tests, builds, and release workflows

## Key File Locations

**Entry Points:**
- `src/index.js`: Main plugin class (RolloverTodosPlugin) extending Obsidian Plugin. Loaded by Obsidian runtime on startup.
- `manifest.json`: Plugin metadata defining id, name, version, minAppVersion, author, and description. Read by Obsidian to identify plugin.

**Configuration:**
- `package.json`: NPM dependencies (obsidian, obsidian-daily-notes-interface, vitest, prettier, rollup), build/dev scripts
- `rollup.config.js`: Build configuration. Entry: `src/index.js`, output: `main.js`, format: commonjs, external: obsidian

**Core Logic:**
- `src/index.js`: Plugin orchestration, settings management, file validation, rollover workflow, undo history
- `src/get-todos.js`: TodoParser class with markdown todo extraction, indentation tracking, nested item handling, custom status marker support

**UI Components:**
- `src/ui/RolloverSettingTab.js`: Settings UI with 7 configurable toggles and text fields
- `src/ui/UndoModal.js`: Confirmation dialog showing file changes before undo

**Testing:**
- `src/get-todos.test.js`: 21 vitest test cases covering todo extraction, nested items, custom markers, edge cases, Unicode handling

**Build Artifacts:**
- `main.js`: Compiled plugin bundle (CommonJS format, created by rollup)

## Naming Conventions

**Files:**
- Plugin code: lowercase with hyphens (e.g., `get-todos.js`, `rollover-setting-tab.js`)
- Export default: PascalCase class name (e.g., RolloverTodosPlugin, RolloverSettingTab, UndoModal)
- Test files: same name as source with `.test.js` suffix (e.g., `get-todos.test.js`)

**Directories:**
- Feature directories: lowercase (e.g., `ui/`)
- Hidden/config directories: dot prefix (e.g., `.github/`, `.planning/`, `.vscode/`)

**Classes:**
- Plugin main class: RolloverTodosPlugin
- UI classes: [Feature]SettingTab, [Feature]Modal
- Parsers: [Entity]Parser

**Variables and Functions:**
- Exported functions: camelCase (e.g., `getTodos`, `parseDay`)
- Private class methods: prefixed with `#` and camelCase (e.g., `#isTodo()`, `#getIndentation()`)
- Plugin instance variables: camelCase (e.g., `undoHistory`, `undoHistoryTime`, `settings`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_TIME_SINCE_CREATION`)

## Where to Add New Code

**New Feature (affecting settings):**
- Primary code: `src/index.js` - add method and integrate into `rollover()` or `onload()`
- Settings: `src/ui/RolloverSettingTab.js` - add new Setting with getter/setter
- Settings object: `src/index.js` loadSettings() DEFAULT_SETTINGS - add property

**New Parser Feature (todo extraction logic):**
- Implementation: `src/get-todos.js` - add private method to TodoParser class
- Tests: `src/get-todos.test.js` - add test cases with GIVEN/WHEN/THEN structure
- Integration: `src/index.js` `getAllUnfinishedTodos()` - may need to pass new parameters to getTodos()

**New UI Component (modal or dialog):**
- Implementation: Create new file `src/ui/[Feature]Modal.js` exporting class extending Modal
- Integration: `src/index.js` - import, instantiate, and show in appropriate event handler

**Utilities (shared helpers):**
- General utilities: Consider adding to `src/index.js` or create `src/utils.js`
- Parser utilities: Add to `src/get-todos.js` or new `src/parser-utils.js`

## Special Directories

**node_modules/**
- Purpose: Installed NPM dependencies (obsidian, obsidian-daily-notes-interface, vitest, prettier, rollup)
- Generated: Yes
- Committed: No (in .gitignore)

**.vscode/**
- Purpose: VS Code workspace configuration
- Generated: No (checked in)
- Committed: Yes

**.planning/codebase/**
- Purpose: Analysis and planning documentation
- Generated: Yes (via GSD codebase analysis)
- Committed: Yes

---

*Structure analysis: 2026-04-14*
