# Testing Patterns

**Analysis Date:** 2026-04-14

## Test Framework

**Runner:**
- Vitest 3.1.2 - Used as primary test runner
- Config: No `vitest.config.js` file - uses Vitest defaults with ESM support
- Installed as devDependency: `"vitest": "^3.1.2"`

**Assertion Library:**
- Vitest built-in expect API (from Chai)
- No additional assertion library needed

**Run Commands:**
```bash
npm run test                      # Run all tests (vitest)
npm run test -- --watch         # Watch mode (add --watch flag)
npm run test -- --coverage      # Coverage mode (add --coverage flag, if configured)
```

## Test File Organization

**Location:**
- Co-located with source: `src/get-todos.test.js` sits alongside `src/get-todos.js`
- Only one test file in codebase - `src/get-todos.test.js`

**Naming:**
- Pattern: `[module-name].test.js`
- Example: `get-todos.js` → `get-todos.test.js`

**Structure:**
```
src/
├── get-todos.js
├── get-todos.test.js    # Tests for get-todos module
├── index.js             # No tests
└── ui/
    ├── RolloverSettingTab.js    # No tests
    └── UndoModal.js             # No tests
```

## Test Structure

**Suite Organization:**

No `describe` blocks used. Tests organized as flat list of individual `test()` calls. Each test is independent and complete.

```javascript
import { expect, test } from "vitest";
import { getTodos } from "./get-todos";

test("single todo element should return itself", () => {
  // GIVEN
  const lines = ["- [ ] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = ["- [ ] tada"];
  expect(result).toStrictEqual(todos);
});
```

**Patterns:**
- Given-When-Then (Arrange-Act-Assert) structure used consistently
- Comments mark each section: `// GIVEN`, `// WHEN`, `// THEN`
- Setup code in GIVEN section creates test data
- Single logical operation in WHEN section
- Assertions in THEN section
- One assertion per test (mostly) - uses `toStrictEqual()` for comprehensive validation

**Example Pattern (lines 4-14 of get-todos.test.js):**
```javascript
test("single todo element should return itself", () => {
  // GIVEN
  const lines = ["- [ ] tada"];

  // WHEN
  const result = getTodos({ lines });

  // THEN
  const todos = ["- [ ] tada"];
  expect(result).toStrictEqual(todos);
});
```

## Mocking

**Framework:** None detected - Vitest can use native mocking, but not used in current tests

**Patterns:**
- No mocking used in existing tests
- All tests use real `TodoParser` implementation
- No spy/stub patterns
- Direct function import and invocation: `import { getTodos } from "./get-todos"`

**What to Mock (if adding tests):**
- File system operations (currently no tests for `index.js` which reads files)
- Obsidian app API (currently no tests for plugin class)
- Time/date operations (currently not tested in isolation)

**What NOT to Mock:**
- Core business logic (`TodoParser`, `getTodos` parsing)
- String manipulation and regex operations
- Data validation and filtering

## Fixtures and Factories

**Test Data:**
- Inline fixture arrays defined in each test
- No external fixture files
- Simple structure: Array of markdown strings representing file lines

```javascript
const lines = [
  "- [ ] TODO",
  "    - [ ] Next",
  "    - some stuff",
  "- [ ] Another one",
  "    - [ ] More children",
  "    - another child",
  "- this isn't copied",
];
```

**Location:**
- Test data defined inline within each test function
- No separate fixtures directory
- Reusable patterns repeated across tests for consistency

**Examples of test data patterns:**
- Single-item lists: `["- [ ] tada"]`
- Multi-item lists with hierarchy
- Mixed bullet symbols: `["-", "*", "+"]`
- Custom status markers: emoji-based checkboxes
- Edge cases: grapheme clusters, control characters, combining characters

## Coverage

**Requirements:** No enforced coverage targets

**View Coverage (if needed):**
```bash
npm run test -- --coverage
```

Note: Coverage not currently configured or reported in package.json scripts.

## Test Types

**Unit Tests:**
- All 20 tests in `get-todos.test.js` are unit tests
- Scope: Test `TodoParser` class and `getTodos()` function in isolation
- Approach: Black-box testing - provide input array, verify output array
- No dependencies on Obsidian API or file system

**Integration Tests:**
- Not present in codebase
- Would test: `index.js` plugin behavior with Obsidian API
- Would require: Mock Obsidian app, vault, and plugin lifecycle

**E2E Tests:**
- Not present in codebase
- Not applicable: Obsidian plugin requires running in Obsidian environment
- Testing done manually by loading plugin in Obsidian

## Common Patterns

**Test Structure - Basic Pattern:**
```javascript
test("descriptive test name", () => {
  // GIVEN - setup
  const input = [...];
  
  // WHEN - execute
  const result = function(input);
  
  // THEN - assert
  expect(result).toStrictEqual(expectedOutput);
});
```

**Async Testing:**
- No async tests present
- `getTodos()` is synchronous function
- If async needed: Use async test function signature:
```javascript
test("async test name", async () => {
  // test body
  await someAsyncOperation();
  expect(...).toBe(...);
});
```

**Error Testing:**
- No error cases tested currently
- `getTodos()` doesn't throw - returns empty array or valid todos
- For error testing: Use `expect(() => { ... }).toThrow()`

**Edge Cases Covered:**

1. **Checkbox Parsing:**
   - Empty checkboxes: `"- [ ]"` and `"- [  ]"` (two spaces)
   - Custom markers: Single emoji, multi-byte Unicode, combining characters
   - Invalid formats: Multiple characters, grapheme modifiers, control characters

2. **List Hierarchy:**
   - Nested items with children
   - Deep nesting (grandchildren)
   - Mixed bullet symbols (`-`, `*`, `+`)
   - Children at end of file
   - No children intermediate items

3. **Completion Status:**
   - Default markers: `x`, `X`, `-`
   - Custom single marker: `"✅"`, `"C"`
   - Custom multi-character markers: `"C?"`, `"xX-"`
   - Only applicable markers count as done

4. **Complex Grapheme Cases:**
   - Multi-byte emoji: `"✅"`, `"❌"`, `"👍"`
   - Heavy checkmarks with variation: `"✔️"`
   - Symbol variations: `"✓"` vs `"✔"`
   - Control characters: null, bell, escape, etc.
   - Combining diacritics: `"a\u0300"` (a + accent)
   - Zero-width characters: ZWJ, ZWNJ, zero-width space
   - RTL override character: `"\u202E"`

**Test Data Patterns:**

Lines with inline comments show intent:
```javascript
test("test name", () => {
  const lines = [
    "- [ ] Normal task",                    // Should be included
    "- [✅] Checkmark emoji",               // Depends on doneStatusMarkers
    "- [\u0000] Null",                      // Control character
    "- [a\u0300] Letter with accent",      // Combining diacritics
  ];
  // ...
});
```

## Test Coverage Summary

**Tested:**
- `getTodos()` exported function with all parameter combinations
- `TodoParser` class logic through public `getTodos()` method
- Checkbox regex parsing
- Completion marker detection
- Grapheme cluster handling
- Nested children extraction
- Custom status marker configuration

**Not Tested:**
- Plugin class (`RolloverTodosPlugin`) - requires Obsidian environment
- Settings persistence (`loadSettings()`, `saveSettings()`)
- File operations (`rollover()`, `getAllUnfinishedTodos()`)
- UI components (`RolloverSettingTab`, `UndoModal`)
- Vault interactions
- Event handling
- Undo/redo history logic

## Running Tests

**Basic test run:**
```bash
npm test
```

**With watch mode (auto-rerun on file changes):**
```bash
npm test -- --watch
```

**Single test file:**
```bash
npm test src/get-todos.test.js
```

**Test with pattern matching:**
```bash
npm test -- --grep "custom status"
```

---

*Testing analysis: 2026-04-14*
