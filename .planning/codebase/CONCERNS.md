# Codebase Concerns

**Analysis Date:** 2026-04-14

## Tech Debt

**Commented-out HTML generation function:**
- Issue: Large recursive function `createRepresentationFromHeadings()` at `src/index.js` lines 13-38 is commented out but still compiled into the codebase
- Files: `src/index.js` (lines 13-38)
- Impact: Dead code increases bundle size, creates maintenance confusion about whether the feature will be implemented
- Fix approach: Either remove entirely if feature is abandoned, or uncomment and complete the rollover-to-subheadings implementation (see TODO at line 208)

**Unimplemented feature remains in code:**
- Issue: The TODO comment at `src/index.js:208` indicates rollover-to-subheadings is planned but commented out, creating inconsistency between design and implementation
- Files: `src/index.js` (lines 208-209)
- Impact: Users cannot utilize subheading-aware todo rollover; feature is partially designed but blocked/abandoned
- Fix approach: Complete the feature implementation or document why it was deferred, remove the TODO if permanently postponed

**Dead code remains callable:**
- Issue: Function `sortHeadersIntoHierarchy()` at `src/index.js:135-145` exists but is never called; it references the commented-out `createRepresentationFromHeadings()` function
- Files: `src/index.js` (lines 135-145)
- Impact: Unreachable function increases cognitive load; the function call to undefined `createRepresentationFromHeadings()` would fail at runtime if invoked
- Fix approach: Remove the function entirely, or uncomment dependencies and wire it into the rollover flow

## Known Bugs

**String length check on number type:**
- Issue: In `src/ui/UndoModal.js:19` and `src/ui/UndoModal.js:21`, code checks `diff.length > 1` where `diff` is a number (result of `Math.abs()`)
- Symptoms: Plural suffix logic for "line" vs "lines" never triggers correctly. Always displays singular "line" regardless of actual count
- Files: `src/ui/UndoModal.js` (lines 19, 21)
- Trigger: Any undo modal display involving line count differences
- Workaround: None - the UI display is always grammatically incorrect for plurals (e.g., "add 5 line" instead of "add 5 lines")
- Fix: Change `diff.length > 1` to `diff > 1` on both lines

**Equality comparison instead of strict equality:**
- Issue: `src/ui/UndoModal.js:23` uses loose equality `oldContent == currentContent` instead of strict equality
- Symptoms: May produce false positives/negatives if one operand is coerced to a different type
- Files: `src/ui/UndoModal.js` (line 23)
- Trigger: When reverting content via undo
- Workaround: None
- Fix: Change `==` to `===` for consistency and correctness

**Loose equality in file comparison:**
- Issue: `src/ui/UndoModal.js:35` and `src/ui/UndoModal.js:50` use loose equality to check for undefined (`!= undefined` instead of `!== undefined`)
- Symptoms: May accidentally match `null` or other falsy values
- Files: `src/ui/UndoModal.js` (lines 35, 50)
- Trigger: When `previousDay.file` is null or falsy
- Workaround: None
- Fix: Change `!= undefined` to `!== undefined`

## Performance Bottlenecks

**Inefficient heading extraction in settings tab:**
- Issue: `src/ui/RolloverSettingTab.js:26` uses `Array.from(templateContents.matchAll(...))` on entire file content; re-runs on every settings display
- Problem: No caching of template file headings; if template has thousands of lines, regex matching runs repeatedly
- Files: `src/ui/RolloverSettingTab.js` (lines 26-29)
- Cause: `display()` method is called every time settings tab opens, with no memoization
- Improvement path: Cache parsed headings in plugin instance, invalidate on template file changes via vault event listener

**Repeated array iteration in line comparison:**
- Issue: `src/index.js:297-301` iterates backwards through entire lines array for each todo item found
- Problem: `todos_yesterday.includes(lines[i])` has O(n) complexity, making the deletion loop O(n²) overall
- Files: `src/index.js` (lines 297-301)
- Cause: Using array `.includes()` for lookup instead of Set or Map
- Improvement path: Convert `todos_yesterday` to a Set before the deletion loop for O(1) lookups

**Repeated file reads in undo modal:**
- Issue: `src/ui/UndoModal.js:11` reads current file content during modal display, even though undo history contains the original content
- Problem: Unnecessary I/O to display diff; only matters if file has been edited since rollover
- Files: `src/ui/UndoModal.js` (line 11)
- Cause: Implementation reads current state to calculate line count differences
- Improvement path: Precompute line counts during rollover and store in undo history instead of reading on modal open

## Fragile Areas

**Date-based daily note identification:**
- Files: `src/index.js` (lines 70-106, 161-192)
- Why fragile: Multiple validation checks for daily note status (folder match, date format parse, creation timestamp). Relies on moment.js date parsing, which can fail silently or produce unexpected results with ambiguous formats
- Safe modification: When touching date logic, test with edge cases: DST transitions, non-standard date formats, timezone differences, folder paths with spaces or special characters
- Test coverage: Limited coverage for date edge cases in test files

**Undo history management with time window:**
- Files: `src/index.js` (lines 343-344, 374-391), `src/ui/UndoModal.js`
- Why fragile: 2-minute time window for undo (hardcoded in line 381) expires silently; undo history is cleared on app close with no persistence or warning
- Safe modification: Changing time window requires checking both index.js line 381 and any UI that displays remaining undo time
- Test coverage: No test coverage for time-based expiration logic

**Content replacement via string matching:**
- Files: `src/index.js` (lines 266-274)
- Why fragile: Uses simple `.replace()` to locate template heading in file content. If heading appears multiple times, only first occurrence is modified. Heading string must match exactly
- Safe modification: When adding features that interact with template headings, test with duplicate headings, headings with special characters, headings with different casing
- Test coverage: No tests for malformed or duplicate headings

## Missing Critical Features

**No template heading validation:**
- Problem: When user selects a template heading from settings dropdown, no validation occurs at rollover time. If heading was deleted/renamed in template, rollover silently falls back to appending at end of file
- Blocks: Users cannot rely on consistent placement of rolled-over todos
- Impact: Silent failures make troubleshooting difficult

**No content backup before destructive operations:**
- Problem: `deleteOnComplete` setting (line 289) directly modifies yesterday's file without intermediate backup beyond undo history
- Blocks: If undo window expires or app crashes, data loss is permanent
- Impact: High-risk operation for users with important notes

**No warning for incomplete rollover:**
- Problem: If daily notes are disabled (lines 195-200), plugin shows notice but doesn't prevent file creation from triggering rollover attempt
- Blocks: Users may create daily notes expecting rollover to work, but nothing happens
- Impact: Silent feature degradation

## Test Coverage Gaps

**No integration tests for rollover operation:**
- What's not tested: End-to-end rollover from yesterday note to today note, including file modification and content placement
- Files: All test files are unit tests (`src/get-todos.test.js`); no integration tests
- Risk: Regressions in core rollover logic may not be caught by CI
- Priority: High

**No tests for settings UI:**
- What's not tested: Template heading dropdown population, setting persistence, toggle state management
- Files: `src/ui/RolloverSettingTab.js`, `src/ui/UndoModal.js` have no test files
- Risk: Settings may become corrupted or unsaved without detection
- Priority: High

**No tests for undo modal:**
- What's not tested: Undo history parsing, line count calculation, modal display accuracy
- Files: `src/ui/UndoModal.js` has no tests
- Risk: Undo feature may fail silently or display incorrect information
- Priority: Medium

**No tests for date parsing and daily note identification:**
- What's not tested: Edge cases in `getLastDailyNote()`, `getFileMoment()`, date format handling
- Files: `src/index.js` date logic (lines 70-122) has no tests
- Risk: Plugin may fail silently or behave inconsistently across different date formats/locales
- Priority: High

**No tests for custom done status markers:**
- What's not tested: While `getTodos()` function has excellent grapheme cluster tests, there are no tests verifying that custom markers properly flow from settings through UI to parser
- Files: Integration between `src/ui/RolloverSettingTab.js:126-130` and `src/get-todos.js:32-40` is untested
- Risk: Settings changes may not propagate correctly to todo detection
- Priority: Medium

---

*Concerns audit: 2026-04-14*
