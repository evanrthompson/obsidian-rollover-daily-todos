# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**Obsidian.md Platform:**
- Obsidian Plugin API - Core integration point
  - SDK/Client: `obsidian` package (imported in `src/index.js`, `src/ui/RolloverSettingTab.js`)
  - API Classes used:
    - `Plugin` - Base class for plugin in `src/index.js` (line 41)
    - `Notice` - UI notifications (used throughout plugin for user feedback)
    - `PluginSettingTab` - Settings UI in `src/ui/RolloverSettingTab.js`
    - `Setting` - Individual settings in settings UI
    - `App` - Vault and file management
    - Vault API - File read/write/modify operations (e.g., `this.app.vault.read()`, `this.app.vault.modify()` in `src/index.js`)
  - Auth: None (plugin runs within Obsidian context)

**Obsidian Daily Notes Interface:**
- Helper library for daily notes functionality
  - SDK/Client: `obsidian-daily-notes-interface` package
  - Functions imported:
    - `getDailyNoteSettings()` - Retrieve daily note configuration
    - `getAllDailyNotes()` - Get all daily note files
    - `getDailyNote()` - Find specific daily note by date
  - Used in: `src/index.js`, `src/ui/RolloverSettingTab.js`
  - Auth: None

## Data Storage

**File Storage:**
- Local filesystem (Obsidian vault) only
  - Markdown files are read/written via Obsidian Vault API
  - No remote storage integration
  - All data stored in user's local Obsidian vault directory

**Databases:**
- None used

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None - Plugin operates within Obsidian authenticated context
- No user authentication required (users are authenticated to Obsidian itself)

## Monitoring & Observability

**Error Tracking:**
- None - Console logging only

**Logs:**
- Browser/Electron console via `console.log()` and `console.error()`
  - Examples in `src/index.js`:
    - Line 214: `console.log()` for rollover operation tracking
    - Line 25: `console.error()` for Intl.Segmenter fallback
  - Obsidian developer console access via Ctrl+Shift+I or Cmd+Option+I

## CI/CD & Deployment

**Hosting:**
- Obsidian Community Plugins repository (manual community publishing)
- GitHub repository: Source distribution
- No automated deployment pipeline detected

**CI Pipeline:**
- Not configured

## Environment Configuration

**Required Env Vars:**
- None - Plugin requires no environment configuration

**Runtime Settings (User-Configurable):**
- Settings stored via Obsidian's `plugin.loadData()` and `plugin.saveData()` in `src/index.js`:
  - `templateHeading` - Where to rollover todos (default: "none")
  - `deleteOnComplete` - Remove completed todos from previous day (default: false)
  - `removeEmptyTodos` - Filter empty checkboxes (default: false)
  - `rolloverChildren` - Include nested todos (default: false)
  - `rolloverOnFileCreate` - Auto-rollover when daily note created (default: true)
  - `doneStatusMarkers` - Custom completion markers (default: "xX-")
  - `leadingNewLine` - Add newline before rolled todos (default: true)

**Secrets Location:**
- None - No secrets management needed

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## File System Integration

**Vault Operations:**
- Read daily notes: `this.app.vault.read(file)` in `src/index.js` (lines 125, 137, 257, 290)
- Write to daily notes: `this.app.vault.modify(file, content)` in `src/index.js` (lines 285, 304)
- File metadata access: `file.stat.ctime`, `file.path`, `file.basename`, `file.extension` (throughout `src/index.js`)

**Daily Note Discovery:**
- Uses Obsidian's file system to find daily notes via regex matching
- Filters by folder and date format from settings
- Moment.js integration (accessed via `window.moment`) for date manipulation

## Plugin Interaction

**Internal Plugins:**
- Daily Notes plugin detection: `this.app.internalPlugins.plugins["daily-notes"]` in `src/index.js` (line 60)
- Checks if Daily Notes or Periodic Notes plugin is enabled before rollover

**Community Plugins:**
- Periodic Notes plugin detection: `this.app.plugins.getPlugin("periodic-notes")` in `src/index.js` (line 63)
- Falls back to Periodic Notes if Daily Notes not enabled

## Events & Lifecycle

**Obsidian Events:**
- File creation event: `this.app.vault.on("create", ...)` in `src/index.js` (line 355)
  - Triggers automatic rollover when new daily note is created

**Commands:**
- Registered commands:
  - "Rollover Todos Now" - Manual rollover trigger
  - "Undo last rollover" - Undo functionality with 2-minute window

---

*Integration audit: 2026-04-14*
