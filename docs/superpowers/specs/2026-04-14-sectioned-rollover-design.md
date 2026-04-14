# Sectioned Rollover — Design Spec

**Date:** 2026-04-14
**Status:** Approved for planning
**Plugin version target:** next minor (1.3.0 suggested)

## Motivation

Users want to organize their daily-note todos under arbitrary sub-headers (e.g. `### asap`, `### this week`, `### someday`) and have that organization persist across daily notes. The current plugin rolls over unfinished todos as a flat list, discarding any structure the user placed around them.

This spec replaces the flat-rollover behavior with section-based rollover: a single user-defined heading delimits a region of the note; that region (minus completed todos and their children) is merged into today's note at the same heading.

## Scope & Breaking Changes

- Section mode becomes the **only** rollover mode. Flat-list rollover is removed.
- Users with an empty `templateHeading` will see a notice ("Set a template heading in settings to enable rollover") on the next rollover instead of automatic flat behavior.
- No stored-data migration required; `templateHeading` key is reused with a new semantic.
- Must be called out in the changelog and README.

## Behavior Summary

1. User defines a delimiting heading via the `templateHeading` setting (e.g. `## Rollover`). The daily-note template includes that heading, typically with empty sub-headers below it.
2. On rollover (automatic on file create, or manual via command):
   - Locate the section on yesterday's note. Missing → notice + stop.
   - Locate the section on today's note. Missing → notice + stop.
   - Parse yesterday's section, trim completed todos (and their children), apply `rolloverChildren` and `removeEmptyTodos` rules.
   - Merge into today's section by matching sub-headers (append at bottom of each match; create new sub-sections at the end of today's section for yesterday-only headers).
   - If `deleteOnComplete`, remove the rolled unfinished todos from yesterday's section only.
3. Undo mechanism unchanged (snapshots both file contents pre-rollover).

## Section Boundaries

- A section begins on the line **after** the `templateHeading` line.
- A section ends at the **next heading of equal or higher level**, or end of file.
  - Example: `## Rollover` ends at the next `#` or `##`. `### asap` inside is part of the section.
- The **first occurrence** of the template heading is used when multiple exist.
- Heading match is exact-string (case-sensitive), compared as raw heading lines with trailing whitespace trimmed on both sides.

## Data Model

```
Section
├── preamble: string[]          // lines between heading and first sub-header
└── subsections: SubSection[]
    ├── heading: string         // e.g. "### asap"
    ├── headingLevel: number    // 3 for ###, 4 for ####
    └── body: string[]          // all lines up to next sub-header or section end
```

Sub-sections are opened at any deeper level than the section heading. A deeper-level heading inside a sub-section's body stays part of that sub-section.

## Trimming Rules (yesterday's section, pre-merge)

Walk lines. For each line:

- **Completed todo** (matches `doneStatusMarkers`): drop the line and every subsequent line whose indentation is strictly greater than the todo's indent, stopping when indentation returns to ≤ the todo's indent.
- **Unfinished todo**:
  - Keep the todo line.
  - Keep its deeper-indented children **only if** `rolloverChildren` is on; otherwise drop the children (same indentation rule as above).
  - If `removeEmptyTodos` is on and the todo text is blank, drop the todo line (and its children).
- **Non-todo line** (heading, paragraph, blank, etc.): keep.

"Completed" is determined by `doneStatusMarkers` (existing setting); the shared helper that identifies done markers is extracted so the section parser and existing `TodoParser` agree.

## Merge Algorithm (into today's section)

1. Parse today's section into the same `Section` tree.
2. Append yesterday's `preamble` (after trim) to the bottom of today's `preamble`.
3. For each yesterday `SubSection`:
   - Find today's `SubSection` with an exact-string heading match (trimmed).
   - If found: append yesterday's trimmed body at the bottom of today's body for that sub-section.
   - If not found: append the entire yesterday sub-section (heading line + trimmed body) to the end of today's `subsections`, preserving its heading level.
4. Serialize today's `Section` back into today's file content.

`leadingNewLine` applies to sub-section bodies when merging (insert a blank line before appended content if enabled).

## Error & Edge Cases

| Condition                                          | Response                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `templateHeading` empty                            | Notice: "Set a template heading in settings to enable rollover." No file changes.               |
| Yesterday's note has no matching heading           | Notice: "Rollover section heading `<heading>` not found in yesterday's note." No file changes.  |
| Today's note has no matching heading               | Notice: "Rollover section heading `<heading>` not found in today's note." No file changes.      |
| Yesterday's section contains no unfinished todos after trimming | Rollover still proceeds: preamble and sub-headers with non-todo loose text still merge. If nothing at all survives the trim, today's file is not modified; completion notice reports 0 todos. |
| Multiple template-heading occurrences              | Use first occurrence on each note.                                                              |
| Identical sub-header lines within one section      | All merge into the first match on today's side. Document in README.                             |

Undo history is snapshotted only when an actual file write occurs (i.e., not on skip-cases above).

## Settings

No new settings. Existing settings' behavior within section mode:

| Setting               | Status   | Behavior in section mode                                                                   |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `templateHeading`     | Kept     | Now the rollover section heading. UI label and description updated to reflect new meaning. |
| `deleteOnComplete`    | Kept     | Removes rolled unfinished todos (and their children if `rolloverChildren`) from yesterday's section only. Sub-headers, completed todos, and loose text remain on yesterday. |
| `removeEmptyTodos`    | Kept     | Drops blank unfinished todos during the trim pass.                                         |
| `rolloverChildren`    | Kept     | When on, deeper-indented lines under unfinished todos roll; when off, they don't.           |
| `rolloverOnFileCreate`| Kept     | Unchanged — controls auto vs. manual trigger.                                              |
| `doneStatusMarkers`   | Kept     | Unchanged — defines which markers count as "done" for the completed-todo rule.             |
| `leadingNewLine`      | Kept     | Applies to merged sub-section bodies (blank line before appended content if on).           |

### UI Copy Changes (`src/ui/RolloverSettingTab.js`)

- **`templateHeading`** label: "Rollover section heading". Description:

  > The heading that delimits the rollover section on both yesterday's and today's daily notes. Everything inside this section (sub-headers, todos, notes) is copied to today's note when a new daily note is created, with completed todos and their nested content left behind.
  >
  > Example: `## Rollover`
  >
  > The section ends at the next heading of equal or higher level. Sub-headers inside (e.g. `### asap`, `### this week`) are preserved; unfinished todos are merged under matching sub-headers on today's note, or appended as new sub-headers if today doesn't have them yet.

- **`deleteOnComplete`** description: "Removes rolled unfinished todos from yesterday's rollover section. Sub-headers and completed todos remain."

- **`rolloverChildren`**, **`removeEmptyTodos`**, **`leadingNewLine`**, **`rolloverOnFileCreate`**, **`doneStatusMarkers`**: no copy changes required.

## Code Organization

New files:

- `src/get-section.js` — `SectionParser` class and `getSection()` utility. Pure parsing logic, no Obsidian API coupling (mirrors `get-todos.js`).
- `src/merge-section.js` (or inline in `index.js` — implementation choice during planning) — the trim + merge algorithm.
- `src/get-section.test.js` — Vitest tests for the section parser.
- `src/rollover-section.test.js` — Vitest tests for trim + merge.

Modified files:

- `src/index.js` — `rollover()` method replaces flat-list logic with section-based logic. Resolve heading → parse sections → trim → merge → write. `deleteOnComplete` branch removes rolled items from yesterday's section instead of whole note.
- `src/ui/RolloverSettingTab.js` — update label + description for `templateHeading` and `deleteOnComplete`.
- `README.md` — document the new behavior, call out the breaking change, include an example template.
- `manifest.json`, `versions.json`, `package.json` — bump version (e.g. 1.3.0).

Shared concern: the "is this a completed todo?" check currently lives inside `TodoParser`. Extract it into a small helper (e.g. `isDoneTodo(line, doneStatusMarkers)` in `get-todos.js` or a new `todo-utils.js`) so both the existing parser and the new section trim logic use the same definition.

## Testing Strategy

Framework: Vitest (existing). Style: Given-When-Then, matching `src/get-todos.test.js`.

### `src/get-section.test.js`

- Extract section between `## Rollover` and next `## Notes`.
- Section runs to EOF when no terminating heading follows.
- Sub-headers of deeper level stay inside (`### asap` inside `## Rollover`).
- Equal-level heading terminates (`## Notes` after `## Rollover`).
- Preamble lines captured when text sits between section heading and first sub-header.
- Missing heading returns a sentinel (null or similar) so caller can show the notice.
- First-occurrence behavior when the same heading appears twice in a note.
- Unicode / grapheme parity with existing `TodoParser` conventions.

### `src/rollover-section.test.js`

- Completed todo drops with all deeper-indented children.
- Unfinished todo keeps children when `rolloverChildren=true`; drops them when `false`.
- `removeEmptyTodos=true` drops blank unfinished todos.
- Custom `doneStatusMarkers` (e.g. `x`, `-`, `/`) treated as done.
- Merge: matching sub-header → append at bottom of today's sub-section body.
- Merge: yesterday sub-header not present on today → appended as new sub-section at end of today's section.
- Merge: preamble lines appended to today's preamble at bottom.
- Heading level preserved when a new sub-section is added on today.
- Exact-string heading match (case-sensitive, trailing whitespace trimmed).
- `leadingNewLine=true` inserts blank line before appended content.

### Manual / Integration Check Before Release

- Fresh daily note created from a template containing `## Rollover\n### asap\n### this week` → auto-merge on create works end-to-end.
- Yesterday missing section heading → notice appears; no files modified.
- Today missing section heading → notice appears; no files modified.
- Manual rollover against a today's note that already has content under sub-headers → new content appended at bottom.
- Undo within 2 minutes → both files restored.
- `deleteOnComplete=true` → yesterday's section retains completed todos and sub-headers; rolled unfinished todos removed.

## Out of Scope

- Multiple rollover sections on one note.
- Rolling over based on explicit start/end markers (HTML comments, `%%` comments).
- Cross-day aggregation beyond yesterday → today.
- Intelligent merging (dedup, reordering) beyond the append-at-bottom rule.
- Renaming the `templateHeading` storage key (no migration required if we keep the key).

## Changelog / Upgrade Notes (to include in release)

- **Breaking:** flat unfinished-todo rollover is removed. The plugin now rolls over the content of a user-defined section instead.
- Users should add a section heading (e.g. `## Rollover`) to their daily-note template and organize todos beneath it (optionally under sub-headers).
- If `templateHeading` was previously empty, set it now; otherwise rollover will no-op with a notice.
- The meaning of `templateHeading` has shifted: it is now the delimiter of the rollover section, not just the injection point.
