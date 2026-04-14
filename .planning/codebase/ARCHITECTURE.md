# Architecture

**Analysis Date:** 2026-04-14

## Pattern Overview

**Overall:** Obsidian Plugin with Single Responsibility Pattern

This is a plugin-based architecture where the main plugin class (`RolloverTodosPlugin`) orchestrates the core workflow: detect daily note creation, parse todos from previous note, filter based on user settings, and insert into today's note with optional undo capability.

**Key Characteristics:**
- Obsidian Plugin API integration (extends `Plugin` class)
- Event-driven: responds to file creation and user commands
- Settings-driven: all behaviors controlled via user-configurable settings
- Stateful: maintains undo history in memory with time-based expiration
- Parser-based: dedicated todo extraction logic separated from plugin orchestration

## Layers

**Plugin Layer:**
- Purpose: Core plugin lifecycle, event registration, command handlers, settings management
- Location: `src/index.js`
- Contains: RolloverTodosPlugin class with onload, rollover, settings management, undo history
- Depends on: Obsidian API, obsidian-daily-notes-interface, moment.js, UI components
- Used by: Obsidian runtime

**Parser Layer:**
- Purpose: Extract unfinished todos from markdown lines with configurable completion markers
- Location: `src/get-todos.js`
- Contains: TodoParser class and getTodos utility function
- Depends on: Nothing (pure parsing logic)
- Used by: Plugin layer to extract todos from file content

**UI Layer:**
- Purpose: User-facing settings interface and confirmation modals
- Location: `src/ui/RolloverSettingTab.js`, `src/ui/UndoModal.js`
- Contains: Settings configuration panel and undo confirmation dialog
- Depends on: Obsidian API, daily notes interface
- Used by: Plugin layer to display settings and undo confirmations

## Data Flow

**Automatic Rollover (on file create):**

1. Obsidian detects new markdown file creation
2. `registerEvent` handler triggers `rollover(file)` with the newly created file
3. Rollover validates file is a daily note (path, format, creation time)
4. If valid and daily notes enabled: fetch yesterday's note via `getLastDailyNote()`
5. Extract unfinished todos from yesterday via `getTodos()` with current settings
6. Filter todos based on user settings (removeEmptyTodos, rolloverChildren, doneStatusMarkers)
7. Read today's file content and inject todos at template heading or end-of-file
8. Optionally delete rolled todos from yesterday (if deleteOnComplete enabled)
9. Store rollover state in `undoHistory` for 2-minute window
10. Display completion notice to user

**Manual Rollover (via command):**

1. User executes "Rollover Todos Now" command
2. `rollover()` called without file parameter
3. Fetches today's daily note via `getDailyNote(moment(), allDailyNotes)`
4. Proceeds identically to automatic rollover flow

**Undo Operation:**

1. User executes "Undo last rollover" within 2-minute window
2. `UndoModal` opens showing file changes to be reverted
3. User confirms undo
4. `confirmUndo()` restores both today and yesterday files to pre-rollover content
5. Clears undo history

**State Management:**

- Plugin settings: persisted to Obsidian data store via `loadData()`/`saveData()`
- Undo history: in-memory array with single entry, expires after 2 minutes or app close
- Daily note state: read directly from vault, modified via `app.vault.modify()`

## Key Abstractions

**TodoParser:**
- Purpose: Encapsulate markdown todo parsing logic with support for nested items and custom completion markers
- Examples: `src/get-todos.js`
- Pattern: Private instance variables (`#lines`, `#withChildren`, `#doneStatusMarkers`) protect state
- Separates parsing concerns: indentation detection, children enumeration, todo identification, grapheme segmentation

**Plugin Settings:**
- Purpose: Centralize configurable behaviors
- Settings object contains: templateHeading, deleteOnComplete, removeEmptyTodos, rolloverChildren, rolloverOnFileCreate, doneStatusMarkers, leadingNewLine
- Loaded from Obsidian storage on plugin load, modified by settings tab, persisted via `saveSettings()`

**Undo History:**
- Purpose: Enable reversal of rollover operations within a time window
- Stores: `{ previousDay: { file, oldContent }, today: { file, oldContent } }`
- Time-based validity: checked before allowing undo command

## Entry Points

**Plugin Initialization:**
- Location: `src/index.js` export default RolloverTodosPlugin
- Triggers: Obsidian plugin system on app startup
- Responsibilities: Loads settings, registers events and commands, initializes undo history

**File Creation Event:**
- Location: `src/index.js` registerEvent for 'create'
- Triggers: Any markdown file creation in vault
- Responsibilities: Calls `rollover(file)` if automatic rollover enabled

**Manual Rollover Command:**
- Location: `src/index.js` addCommand with id 'obsidian-rollover-daily-todos-rollover'
- Triggers: User executes "Rollover Todos Now"
- Responsibilities: Calls `rollover()` without parameters to fetch today's note

**Settings Tab Display:**
- Location: `src/ui/RolloverSettingTab.js` display()
- Triggers: User opens plugin settings
- Responsibilities: Renders 7 configurable settings, persists changes via `plugin.saveSettings()`

## Error Handling

**Strategy:** Fail gracefully with user notices

**Patterns:**

- Daily notes plugin check: Returns early if daily notes not enabled, shows 10-second notice
- Missing yesterday note: Returns early without error if `getLastDailyNote()` returns null
- Template heading not found: Falls back to appending at end-of-file, includes warning message in notice
- File read/write failures: Relies on Obsidian API error handling (not explicitly caught)
- Undo window expired: Command returns false, preventing undo UI from showing
- Todo extraction edge cases: Thoroughly tested via test suite for malformed todos, custom markers, nested items

## Cross-Cutting Concerns

**Logging:** Uses browser `console.log()` for debugging. Examples: todo count, setting changes, template heading matching.

**Validation:** Daily note detection via multiple criteria (path prefix, date parsing, creation time, format matching). Todo validation via regex and grapheme segmentation to handle Unicode properly.

**File Access:** All file operations go through `app.vault` (Obsidian API). Reads via `app.vault.read()`, writes via `app.vault.modify()`. No direct filesystem access.

---

*Architecture analysis: 2026-04-14*
