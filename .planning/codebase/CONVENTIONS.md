# Coding Conventions

**Analysis Date:** 2026-04-14

## Naming Patterns

**Files:**
- JavaScript files use lowercase with hyphens for separators: `get-todos.js`, `RolloverSettingTab.js`
- Test files use `.test.js` suffix: `get-todos.test.js`
- Class files use PascalCase for class names even when in lowercase files: `RolloverTodosPlugin`, `RolloverSettingTab`, `UndoModal`
- Utility functions exported from modules are camelCase: `getTodos()`

**Functions:**
- Class methods use camelCase: `loadSettings()`, `saveSettings()`, `getAllUnfinishedTodos()`, `rollover()`, `onLoad()`
- Private methods prefixed with `#`: `#isTodo()`, `#hasChildren()`, `#getChildren()`, `#isChildOf()`, `#getIndentation()`, `#parseIntoChars()`
- Lifecycle hooks follow Obsidian plugin convention: `onload()`, `onClose()`, `onOpen()`
- Async operations explicitly marked: `async loadSettings()`, `async saveSettings()`, `async rollover()`

**Variables:**
- Local variables use camelCase: `templateHeading`, `deleteOnComplete`, `removeEmptyTodos`, `dailyNoteFiles`
- Constants use UPPER_SNAKE_CASE: `MAX_TIME_SINCE_CREATION`, `DEFAULT_SETTINGS`
- Private class properties use `#` prefix: `#lines`, `#withChildren`, `#parseIntoChars()`
- Boolean variables often prefix with `is`: `ignoreCreationTime`, `unclosedLi`, `templateHeadingSelected`, `dailyNotesEnabled`, `isDailyNotesEnabled()`

**Types:**
- No TypeScript used - plain JavaScript with runtime type handling
- Constructor parameters clearly named: `constructor(lines, withChildren, doneStatusMarkers)`

## Code Style

**Formatting:**
- Prettier installed (`prettier ^2.8.1`) but no configuration file present - uses Prettier defaults
- Default Prettier settings applied: 80-char line length (soft limit), 2-space indents, trailing commas
- Format command: `npm run format` (runs `prettier --write .`)

**Linting:**
- No ESLint configuration detected
- No specific linting rules enforced

**Semicolons:**
- Semicolons used consistently throughout
- Module imports/exports include semicolons

**Indentation:**
- 2 spaces for indentation (Prettier default)
- Consistent throughout codebase

**String Quotes:**
- Double quotes used primarily for strings in imports and general code
- Single quotes occasionally used in single-quoted contexts (e.g., `'h3'` in modal creation)
- Consistent quote style within each file

## Import Organization

**Order:**
1. Framework/library imports (obsidian, obsidian-daily-notes-interface)
2. Local module imports (relative paths)
3. No named imports for default exports

**Examples from codebase:**
```javascript
// index.js
import { Notice, Plugin } from "obsidian";
import {
  getDailyNoteSettings,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";
import UndoModal from "./ui/UndoModal";
import RolloverSettingTab from "./ui/RolloverSettingTab";
import { getTodos } from "./get-todos";
```

```javascript
// RolloverSettingTab.js
import { Setting, PluginSettingTab } from "obsidian";
import { getDailyNoteSettings } from "obsidian-daily-notes-interface";
```

**Path Aliases:**
- No path aliases configured (using relative imports)

## Error Handling

**Patterns:**
- Try-catch blocks not used explicitly - relies on async/await error propagation
- Null checks used before operations: `if (!file) return;`, `if (file === null)`
- Optional chaining with nullish coalescing: `periodicNotesPlugin?.settings?.daily?.enabled`
- Defensive checks before file access: Check folder validity, check if file exists before reading
- Example from `getLastDailyNote()`: Validates file path, filters for valid dates, handles undefined

**Error Messages:**
- User-facing errors wrapped in `Notice` objects with timeout: `new Notice(message, 4000)`
- Console errors for development: `console.error()` used in `#parseIntoChars()` for fallback detection
- No throw statements for plugin functionality - prefers early returns and user notices

## Logging

**Framework:** `console` object

**Patterns:**
- `console.log()` used for informational output: "rollover-daily-todos: X todos found"
- `console.error()` used for error conditions with context
- Debug logging present in settings tab: `console.log(value)` showing setting changes
- Uncommented debug code exists: `///console.log('testing')` in line 136 of index.js
- Production-level logging includes user-facing messages via Notice objects, not console

**When to Log:**
- Log successful rollover operations with todo count
- Log errors only for fallback/degradation scenarios (e.g., Intl.Segmenter unavailability)
- Don't log sensitive file paths in public-facing logs

## Comments

**When to Comment:**
- Used for explaining complex logic: "Check if user defined folder with root `/`"
- Used for non-obvious algorithm steps: "Remove length of folder from start of path"
- Used for business logic reasoning: "Get all notes in directory that aren't null"
- Commented-out code present for future features: Heading recursion logic in index.js (lines 13-39)
- Block comments use `/* */` for multiline explanations

**JSDoc/TSDoc:**
- No JSDoc comments used
- No type annotations present (plain JavaScript)
- Private method comments explaining purpose: "Returns true if string s is a todo-item"

## Function Design

**Size:**
- Functions range from 4-50 lines typically
- Larger functions like `rollover()` (lines 161-346) break logic with clear comment sections
- Helper methods extracted to keep main logic readable

**Parameters:**
- Constructor injection pattern used: `constructor(app, plugin)`
- Configuration objects passed as parameters: `getTodos({ lines, withChildren, doneStatusMarkers })`
- Avoid long parameter lists - use objects for multiple related parameters
- Optional parameters with default values: `#parseIntoChars(content, contentType = "content")`

**Return Values:**
- Boolean returns for validation: `#isTodo()`, `isDailyNotesEnabled()`
- Array returns for collection operations: `getTodos()`, `#getChildren()`
- Objects for structured data: `undoHistoryInstance`
- Early returns for guard clauses: `if (!file) return;`
- No explicit null returns - uses early exit pattern instead

## Module Design

**Exports:**
- Default exports for classes: `export default class RolloverTodosPlugin`
- Named exports for utility functions: `export const getTodos`
- Single export per file in most cases

**Barrel Files:**
- No barrel/index files used to re-export modules
- Direct imports from source files

## Obsidian Plugin Conventions

**Class Extension:**
- Plugin class extends `Plugin`: `class RolloverTodosPlugin extends Plugin`
- Settings tab extends `PluginSettingTab`: `class RolloverSettingTab extends PluginSettingTab`
- Modals extend `Modal`: `class UndoModal extends Modal`

**Lifecycle:**
- `onload()` entry point for plugin initialization
- `onClose()` for cleanup in modal/tab lifecycle
- `onOpen()` for modal initialization
- Async methods for Vault operations: Obsidian API requirement

**Settings Pattern:**
- DEFAULT_SETTINGS object in `loadSettings()`: All configuration options with defaults
- Settings persisted via `this.saveData()`/`this.loadData()`
- Immediate persistence on setting change via onChange callbacks
- Boolean settings with fallback to true: `rolloverOnFileCreate` defaults to true if undefined

**Commands:**
- Registered via `this.addCommand()` in onload
- Include: `id`, `name`, `callback`, optional `checkCallback`
- Check callbacks return false to disable command

**Event Registration:**
- Events registered via `this.registerEvent()`
- Obsidian vault events monitored: `this.app.vault.on("create", ...)`

---

*Convention analysis: 2026-04-14*
