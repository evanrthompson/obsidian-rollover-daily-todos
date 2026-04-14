# Sectioned Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plugin's flat unfinished-todo rollover with section-based rollover: a single user-defined heading delimits a region of the daily note that is scooped from yesterday, trimmed of completed items, and merged into today's note under matching sub-headers.

**Architecture:** A new section parser (`src/get-section.js`) turns a daily note's delimited region into a `Section` tree of preamble lines + sub-sections. A new rollover module (`src/rollover-section.js`) trims yesterday's tree (drops completed todos + their children), merges it into today's tree by matching sub-header strings, and serializes the result. Shared todo helpers extract to `src/todo-utils.js` so the existing `TodoParser` and the new section code agree on what "done" means. `src/index.js`'s `rollover()` method is rewritten to orchestrate the new pipeline. Flat-list rollover is removed.

**Tech Stack:** JavaScript (ES6+), Vitest 3.x for tests, Rollup for bundling, Obsidian Plugin API. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-04-14-sectioned-rollover-design.md`

---

## File Structure

**New files:**
- `src/todo-utils.js` — `getTodoStatus(line, doneStatusMarkers)` returning `"none" | "open" | "done"`; `getIndent(line)` returning indent count.
- `src/todo-utils.test.js` — unit tests for the helpers.
- `src/get-section.js` — `getSection(fileContent, headingLine)` returning `{ headingAbsIndex, endAbsIndex, section } | null`, where `section` is the parsed tree.
- `src/get-section.test.js` — section parser tests.
- `src/rollover-section.js` — `trimSection`, `mergeSection`, `serializeSection`, and the orchestrator `performSectionRollover(yesterdayContent, todayContent, headingLine, opts)`.
- `src/rollover-section.test.js` — trim + merge + orchestrator tests.

**Modified files:**
- `src/get-todos.js` — `TodoParser.#isTodo` rewritten to use `getTodoStatus`.
- `src/index.js` — `rollover()` method rewritten; dead helpers removed.
- `src/ui/RolloverSettingTab.js` — copy updates for `templateHeading` and `deleteOnComplete`.
- `README.md` — new behavior documented; breaking change called out.
- `manifest.json`, `package.json` — version bump to `1.3.0`.
- `versions.json` — add `"1.3.0": "0.12.12"`.

---

## Task 1: Extract `getTodoStatus` and `getIndent` helpers

**Files:**
- Create: `src/todo-utils.js`
- Create: `src/todo-utils.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/todo-utils.test.js`:

```javascript
import { expect, test } from "vitest";
import { getTodoStatus, getIndent } from "./todo-utils";

test("getTodoStatus returns 'open' for unfinished todo", () => {
  expect(getTodoStatus("- [ ] thing")).toBe("open");
  expect(getTodoStatus("  * [ ] indented", "xX-")).toBe("open");
  expect(getTodoStatus("+ [/] partial", "xX-")).toBe("open");
});

test("getTodoStatus returns 'done' when marker matches default 'xX-'", () => {
  expect(getTodoStatus("- [x] done")).toBe("done");
  expect(getTodoStatus("- [X] done")).toBe("done");
  expect(getTodoStatus("- [-] cancelled")).toBe("done");
});

test("getTodoStatus respects custom doneStatusMarkers", () => {
  expect(getTodoStatus("- [x] x with custom markers", "C?")).toBe("open");
  expect(getTodoStatus("- [C] done with C", "C?")).toBe("done");
  expect(getTodoStatus("- [?] done with ?", "C?")).toBe("done");
});

test("getTodoStatus returns 'none' for non-todo lines", () => {
  expect(getTodoStatus("## A heading")).toBe("none");
  expect(getTodoStatus("Some paragraph")).toBe("none");
  expect(getTodoStatus("- a bullet without checkbox")).toBe("none");
  expect(getTodoStatus("")).toBe("none");
});

test("getTodoStatus returns 'none' for malformed checkboxes", () => {
  expect(getTodoStatus("- [] empty")).toBe("none");
  expect(getTodoStatus("- [  ] two spaces")).toBe("none");
});

test("getIndent returns leading whitespace count", () => {
  expect(getIndent("- [ ] thing")).toBe(0);
  expect(getIndent("  - [ ] two-space")).toBe(2);
  expect(getIndent("    - [ ] four-space")).toBe(4);
  expect(getIndent("\t- [ ] tab")).toBe(1);
  expect(getIndent("")).toBe(0);
  expect(getIndent("   ")).toBe(3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/todo-utils.test.js`
Expected: FAIL — `Failed to load url ./todo-utils` or similar "module not found".

- [ ] **Step 3: Implement the helpers**

Create `src/todo-utils.js`:

```javascript
const DEFAULT_DONE_MARKERS = "xX-";

const GRAPHEME_MODIFIERS = ["\u202E", "\u200B", "\u200C", "\u200D"];

function parseIntoChars(content) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(content), (s) => s.segment);
  }
  return Array.from(content);
}

// Returns "none" | "open" | "done"
// "none" = not a todo line at all
// "open" = unfinished todo (empty or unknown marker in checkbox)
// "done" = completed todo (marker is in doneStatusMarkers)
export function getTodoStatus(line, doneStatusMarkers = DEFAULT_DONE_MARKERS) {
  if (typeof line !== "string") return "none";
  const match = line.match(/\s*[*+-] \[(.+?)\]/);
  if (!match) return "none";

  const contentChars = parseIntoChars(match[1]);
  if (contentChars.length !== 1) return "none";

  const hasModifier = contentChars.some((c) => GRAPHEME_MODIFIERS.includes(c));
  if (hasModifier) return "none";

  const markerChars = parseIntoChars(doneStatusMarkers || "");
  const isDone = contentChars.some((c) => markerChars.includes(c));
  return isDone ? "done" : "open";
}

// Number of leading whitespace characters (spaces or tabs), 0 if none.
export function getIndent(line) {
  if (typeof line !== "string" || line.length === 0) return 0;
  const firstNonSpace = line.search(/\S/);
  return firstNonSpace === -1 ? line.length : firstNonSpace;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/todo-utils.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/todo-utils.js src/todo-utils.test.js
git commit -m "feat: add shared getTodoStatus and getIndent helpers"
```

---

## Task 2: Refactor `TodoParser` to use `getTodoStatus`

**Files:**
- Modify: `src/get-todos.js:1-80`

- [ ] **Step 1: Replace `#isTodo` and the parsing helpers to delegate to `todo-utils`**

Edit `src/get-todos.js`. Replace the top of the file (`TodoParser` class definition + `#parseIntoChars` + `#isTodo` + `#getIndentation`) so it imports from `todo-utils` and uses the shared helpers. Keep `#hasChildren`, `#getChildren`, `#isChildOf`, `getTodos()` unchanged.

Replace the entire file with:

```javascript
import { getTodoStatus, getIndent } from "./todo-utils";

class TodoParser {
  #lines;
  #withChildren;
  #doneStatusMarkers;

  constructor(lines, withChildren, doneStatusMarkers) {
    this.#lines = lines;
    this.#withChildren = withChildren;
    this.#doneStatusMarkers = doneStatusMarkers || "xX-";
  }

  #isTodo(s) {
    return getTodoStatus(s, this.#doneStatusMarkers) === "open";
  }

  #hasChildren(l) {
    if (l + 1 >= this.#lines.length) return false;
    return getIndent(this.#lines[l + 1]) > getIndent(this.#lines[l]);
  }

  #getChildren(parentLinum) {
    const children = [];
    let nextLinum = parentLinum + 1;
    while (this.#isChildOf(parentLinum, nextLinum)) {
      children.push(this.#lines[nextLinum]);
      nextLinum++;
    }
    return children;
  }

  #isChildOf(parentLinum, linum) {
    if (parentLinum >= this.#lines.length || linum >= this.#lines.length) {
      return false;
    }
    return getIndent(this.#lines[linum]) > getIndent(this.#lines[parentLinum]);
  }

  getTodos() {
    let todos = [];
    for (let l = 0; l < this.#lines.length; l++) {
      const line = this.#lines[l];
      if (this.#isTodo(line)) {
        todos.push(line);
        if (this.#withChildren && this.#hasChildren(l)) {
          const cs = this.#getChildren(l);
          todos = [...todos, ...cs];
          l += cs.length;
        }
      }
    }
    return todos;
  }
}

export const getTodos = ({
  lines,
  withChildren = false,
  doneStatusMarkers = null,
}) => {
  const todoParser = new TodoParser(lines, withChildren, doneStatusMarkers);
  return todoParser.getTodos();
};
```

- [ ] **Step 2: Run the existing get-todos tests to confirm no regression**

Run: `pnpm test -- src/get-todos.test.js`
Expected: PASS — all existing tests still pass (~15 tests).

- [ ] **Step 3: Commit**

```bash
git add src/get-todos.js
git commit -m "refactor: TodoParser uses shared todo-utils helpers"
```

---

## Task 3: Locate section boundaries in file lines

**Files:**
- Create: `src/get-section.js`
- Create: `src/get-section.test.js`

- [ ] **Step 1: Write failing tests for `locateSection`**

Create `src/get-section.test.js`:

```javascript
import { expect, test } from "vitest";
import { locateSection } from "./get-section";

test("locateSection finds heading and returns range to next equal-level heading", () => {
  const lines = [
    "# Daily Note",
    "",
    "## Rollover",
    "### asap",
    "- [ ] thing",
    "",
    "## Notes",
    "other",
  ];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 2,
    endIndex: 6,
    level: 2,
  });
});

test("locateSection ends at next higher-level heading", () => {
  const lines = [
    "## Rollover",
    "- [ ] thing",
    "# Top-level ends it",
    "more",
  ];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 0,
    endIndex: 2,
    level: 2,
  });
});

test("locateSection keeps deeper-level headings inside the section", () => {
  const lines = [
    "## Rollover",
    "### asap",
    "- [ ] one",
    "#### extra-deep",
    "- [ ] two",
    "## Notes",
  ];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 0,
    endIndex: 5,
    level: 2,
  });
});

test("locateSection runs to end-of-file when no terminating heading", () => {
  const lines = ["# Title", "## Rollover", "- [ ] thing", "- [ ] more"];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 1,
    endIndex: 4,
    level: 2,
  });
});

test("locateSection returns null when heading not found", () => {
  const lines = ["# Title", "- [ ] thing"];
  expect(locateSection(lines, "## Rollover")).toBeNull();
});

test("locateSection matches first occurrence when heading appears twice", () => {
  const lines = [
    "## Rollover",
    "- [ ] first",
    "## Other",
    "## Rollover",
    "- [ ] second",
  ];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 0,
    endIndex: 2,
    level: 2,
  });
});

test("locateSection trims trailing whitespace on both sides when matching", () => {
  const lines = ["## Rollover   ", "- [ ] thing", "## Notes"];
  expect(locateSection(lines, "## Rollover")).toEqual({
    headingIndex: 0,
    endIndex: 2,
    level: 2,
  });
});

test("locateSection returns null if heading arg is not a heading", () => {
  const lines = ["## Rollover", "- [ ] thing"];
  expect(locateSection(lines, "not a heading")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/get-section.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `locateSection`**

Create `src/get-section.js`:

```javascript
// Match an ATX heading: one or more '#' then a space then any content.
// Returns 0 if line is not a heading, else the heading level (1-6).
function headingLevel(line) {
  const match = line.match(/^(#{1,6}) /);
  return match ? match[1].length : 0;
}

// Find the first occurrence of `heading` in `lines` and return the line-index range
// that belongs to its section.
//
// Returns { headingIndex, endIndex, level } where:
//   headingIndex = index of the heading line
//   endIndex = exclusive end; the section body is lines[headingIndex+1..endIndex)
//   level = heading level (1 = '#', 2 = '##', etc.)
//
// The section ends at the next heading of equal or lower level (higher importance),
// or at end-of-file. Deeper-level headings stay inside.
//
// Returns null if `heading` is not a valid heading string or not found in `lines`.
export function locateSection(lines, heading) {
  if (typeof heading !== "string") return null;
  const targetTrimmed = heading.replace(/\s+$/, "");
  const targetLevel = headingLevel(targetTrimmed);
  if (targetLevel === 0) return null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typeof line !== "string") continue;
    if (line.replace(/\s+$/, "") !== targetTrimmed) continue;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const lvl = headingLevel(lines[j]);
      if (lvl > 0 && lvl <= targetLevel) {
        end = j;
        break;
      }
    }
    return { headingIndex: i, endIndex: end, level: targetLevel };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/get-section.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/get-section.js src/get-section.test.js
git commit -m "feat: add locateSection for finding delimited regions"
```

---

## Task 4: Parse section body into `Section` tree (preamble + sub-sections)

**Files:**
- Modify: `src/get-section.js`
- Modify: `src/get-section.test.js`

- [ ] **Step 1: Write failing tests for `parseSectionBody`**

Append to `src/get-section.test.js`:

```javascript
import { parseSectionBody } from "./get-section";

test("parseSectionBody with no sub-headers puts everything in preamble", () => {
  const body = ["- [ ] thing", "- [x] done", "some text"];
  expect(parseSectionBody(body, 2)).toEqual({
    preamble: ["- [ ] thing", "- [x] done", "some text"],
    subsections: [],
  });
});

test("parseSectionBody splits on deeper-level headings", () => {
  const body = [
    "intro line",
    "### asap",
    "- [ ] a",
    "### this week",
    "- [ ] b",
  ];
  expect(parseSectionBody(body, 2)).toEqual({
    preamble: ["intro line"],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] a"] },
      { heading: "### this week", headingLevel: 3, body: ["- [ ] b"] },
    ],
  });
});

test("parseSectionBody keeps a deeper heading inside a sub-section's body", () => {
  const body = [
    "### asap",
    "- [ ] a",
    "#### really-sub",
    "- [ ] nested",
    "### this week",
    "- [ ] b",
  ];
  const result = parseSectionBody(body, 2);
  expect(result.subsections).toEqual([
    {
      heading: "### asap",
      headingLevel: 3,
      body: ["- [ ] a", "#### really-sub", "- [ ] nested"],
    },
    { heading: "### this week", headingLevel: 3, body: ["- [ ] b"] },
  ]);
  expect(result.preamble).toEqual([]);
});

test("parseSectionBody treats level-4 heading as sub-section when section level is 3", () => {
  const body = ["#### one", "- [ ] a", "#### two", "- [ ] b"];
  expect(parseSectionBody(body, 3)).toEqual({
    preamble: [],
    subsections: [
      { heading: "#### one", headingLevel: 4, body: ["- [ ] a"] },
      { heading: "#### two", headingLevel: 4, body: ["- [ ] b"] },
    ],
  });
});

test("parseSectionBody with empty body returns empty preamble and no subsections", () => {
  expect(parseSectionBody([], 2)).toEqual({ preamble: [], subsections: [] });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/get-section.test.js`
Expected: FAIL — `parseSectionBody` is not exported yet.

- [ ] **Step 3: Add `parseSectionBody`**

Append to `src/get-section.js`:

```javascript
// Parse a section's body lines into { preamble, subsections }.
// A "sub-section" opens on a heading at exactly `sectionLevel + 1`. Deeper-level
// headings (sectionLevel + 2 and below) stay part of the current sub-section's body,
// or stay in the preamble if no sub-section has opened yet.
//
// This is tighter than "any deeper level opens a sub-section" — it matches how users
// realistically structure daily notes (`## Rollover` with `### asap`, `### this week`
// sub-sections) and avoids ambiguity when merging.
//
// Returns:
//   {
//     preamble: string[],        // lines before first sub-header
//     subsections: [
//       { heading: string, headingLevel: number, body: string[] }
//     ]
//   }
export function parseSectionBody(bodyLines, sectionLevel) {
  const preamble = [];
  const subsections = [];
  let current = null;

  for (const line of bodyLines) {
    const lvl = headingLevel(line);
    const opensSub = lvl > 0 && lvl === sectionLevel + 1;
    if (opensSub) {
      current = { heading: line, headingLevel: lvl, body: [] };
      subsections.push(current);
    } else if (current) {
      current.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  return { preamble, subsections };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/get-section.test.js`
Expected: PASS — all 13 tests green (8 from Task 3 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/get-section.js src/get-section.test.js
git commit -m "feat: parse section body into preamble and sub-sections"
```

---

## Task 5: Trim yesterday's section — drop completed todos + their children

**Files:**
- Create: `src/rollover-section.js`
- Create: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `trimBodyLines`**

Create `src/rollover-section.test.js`:

```javascript
import { expect, test } from "vitest";
import { trimBodyLines } from "./rollover-section";

const defaultOpts = {
  doneStatusMarkers: "xX-",
  rolloverChildren: true,
  removeEmptyTodos: false,
};

test("trimBodyLines keeps unfinished todo and its children when rolloverChildren=true", () => {
  const lines = ["- [ ] a", "    - [ ] child", "    note under child"];
  const { kept, rolledLineIndices } = trimBodyLines(lines, defaultOpts);
  expect(kept).toEqual(["- [ ] a", "    - [ ] child", "    note under child"]);
  expect(rolledLineIndices).toEqual([0, 1, 2]);
});

test("trimBodyLines drops children of unfinished todo when rolloverChildren=false", () => {
  const lines = ["- [ ] a", "    - [ ] child", "    note"];
  const { kept, rolledLineIndices } = trimBodyLines(lines, {
    ...defaultOpts,
    rolloverChildren: false,
  });
  expect(kept).toEqual(["- [ ] a"]);
  expect(rolledLineIndices).toEqual([0]);
});

test("trimBodyLines drops completed todo and all its deeper children", () => {
  const lines = [
    "- [x] done",
    "    - [ ] child of done",
    "    note under done",
    "- [ ] open",
  ];
  const { kept, rolledLineIndices } = trimBodyLines(lines, defaultOpts);
  expect(kept).toEqual(["- [ ] open"]);
  expect(rolledLineIndices).toEqual([3]);
});

test("trimBodyLines keeps non-todo loose text and sub-bullets at section level", () => {
  const lines = [
    "some paragraph",
    "- not a todo (bullet without checkbox)",
    "- [ ] real todo",
  ];
  const { kept, rolledLineIndices } = trimBodyLines(lines, defaultOpts);
  expect(kept).toEqual([
    "some paragraph",
    "- not a todo (bullet without checkbox)",
    "- [ ] real todo",
  ]);
  // Only the unfinished todo line itself is a "rolled" line (counts toward deleteOnComplete)
  expect(rolledLineIndices).toEqual([2]);
});

test("trimBodyLines removes empty unfinished todos when removeEmptyTodos=true", () => {
  const lines = [
    "- [ ] ",
    "- [ ]",
    "- [  ]",
    "- [ ] real",
  ];
  const { kept, rolledLineIndices } = trimBodyLines(lines, {
    ...defaultOpts,
    removeEmptyTodos: true,
  });
  expect(kept).toEqual(["- [ ] real"]);
  expect(rolledLineIndices).toEqual([3]);
});

test("trimBodyLines keeps empty todos when removeEmptyTodos=false", () => {
  const lines = ["- [ ] ", "- [ ] real"];
  const { kept, rolledLineIndices } = trimBodyLines(lines, defaultOpts);
  expect(kept).toEqual(["- [ ] ", "- [ ] real"]);
  expect(rolledLineIndices).toEqual([0, 1]);
});

test("trimBodyLines with custom doneStatusMarkers treats custom marker as done", () => {
  const lines = ["- [C] done", "- [x] still open under C-only markers"];
  const { kept } = trimBodyLines(lines, {
    ...defaultOpts,
    doneStatusMarkers: "C",
  });
  expect(kept).toEqual(["- [x] still open under C-only markers"]);
});

test("trimBodyLines preserves deeper nested children under unfinished todo", () => {
  const lines = [
    "- [ ] parent",
    "    - [ ] child",
    "        - [ ] grandchild",
    "- [ ] sibling",
  ];
  const { kept } = trimBodyLines(lines, defaultOpts);
  expect(kept).toEqual([
    "- [ ] parent",
    "    - [ ] child",
    "        - [ ] grandchild",
    "- [ ] sibling",
  ]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `trimBodyLines`**

Create `src/rollover-section.js`:

```javascript
import { getTodoStatus, getIndent } from "./todo-utils";

// Return the count of consecutive lines after `start` whose indentation is strictly
// greater than `baseIndent`. These represent "children" of the line at `start`.
// Blank lines and whitespace-only lines never count as children — they terminate the run.
function countChildren(lines, start, baseIndent) {
  let i = start + 1;
  while (
    i < lines.length &&
    lines[i].trim().length > 0 &&
    getIndent(lines[i]) > baseIndent
  ) {
    i++;
  }
  return i - start - 1;
}

// Return true if a line is an empty todo checkbox in any of the forms the plugin
// has historically recognized: '- [ ]', '* [ ]', '+ [ ]', or the malformed
// '- [  ]' (double space inside brackets). A trailing space after the closing bracket
// is tolerated.
//
// Note: getTodoStatus does NOT recognize the double-space form because the checkbox
// content is two graphemes and the parser requires exactly one. So this is the
// single source of truth for "is this an empty unfinished todo line?" in the
// rollover flow.
function isEmptyTodoLine(line) {
  const trimmed = (line || "").trim();
  return (
    trimmed === "- [ ]" ||
    trimmed === "* [ ]" ||
    trimmed === "+ [ ]" ||
    trimmed === "- [  ]" ||
    trimmed === "* [  ]" ||
    trimmed === "+ [  ]"
  );
}

// Walk `lines` and apply the trim rules.
// Returns { kept: string[], rolledLineIndices: number[] }
//   - `kept` = lines to carry forward into today's note (in order, de-duplicated of dropped subtrees)
//   - `rolledLineIndices` = indices into the INPUT `lines` of unfinished-todo lines (and optionally
//     their children) — used to remove them from yesterday when deleteOnComplete is on.
//
// Rules:
//   - Empty unfinished todo (incl. malformed `- [  ]`):
//       - If removeEmptyTodos is on, drop the line + its children (based on indent).
//       - Else keep the line (and children if rolloverChildren); counts toward rolled indices.
//   - Completed todo: drop line + all subsequent lines with indent > the todo's indent.
//   - Unfinished todo (non-empty): keep the todo line. Keep children only if rolloverChildren is on.
//   - Non-todo line (heading, paragraph, loose bullet, blank): always kept; never counted as rolled.
export function trimBodyLines(lines, opts) {
  const { doneStatusMarkers, rolloverChildren, removeEmptyTodos } = opts;
  const kept = [];
  const rolledLineIndices = [];

  const keepOpenTodo = (i, childCount) => {
    kept.push(lines[i]);
    rolledLineIndices.push(i);
    if (rolloverChildren) {
      for (let j = 1; j <= childCount; j++) {
        kept.push(lines[i + j]);
        rolledLineIndices.push(i + j);
      }
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);

    if (isEmptyTodoLine(line)) {
      const childCount = countChildren(lines, i, indent);
      if (removeEmptyTodos) {
        i += 1 + childCount;
        continue;
      }
      keepOpenTodo(i, childCount);
      i += 1 + childCount;
      continue;
    }

    const status = getTodoStatus(line, doneStatusMarkers);

    if (status === "done") {
      const childCount = countChildren(lines, i, indent);
      i += 1 + childCount;
      continue;
    }

    if (status === "open") {
      const childCount = countChildren(lines, i, indent);
      keepOpenTodo(i, childCount);
      i += 1 + childCount;
      continue;
    }

    // status === "none" (non-todo line)
    kept.push(line);
    i++;
  }

  return { kept, rolledLineIndices };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: add trimBodyLines to drop completed todos and apply rolloverChildren"
```

---

## Task 6: Apply the trim to a parsed `Section` tree

**Files:**
- Modify: `src/rollover-section.js`
- Modify: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `trimSection`**

Append to `src/rollover-section.test.js`:

```javascript
import { trimSection } from "./rollover-section";

test("trimSection trims preamble and each sub-section's body", () => {
  const section = {
    preamble: ["- [x] done in preamble", "- [ ] open in preamble"],
    subsections: [
      {
        heading: "### asap",
        headingLevel: 3,
        body: ["- [x] done", "- [ ] open", "    - [ ] child"],
      },
      {
        heading: "### someday",
        headingLevel: 3,
        body: ["- [ ] later"],
      },
    ],
  };
  const { section: trimmed } = trimSection(section, {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  expect(trimmed.preamble).toEqual(["- [ ] open in preamble"]);
  expect(trimmed.subsections).toEqual([
    {
      heading: "### asap",
      headingLevel: 3,
      body: ["- [ ] open", "    - [ ] child"],
    },
    {
      heading: "### someday",
      headingLevel: 3,
      body: ["- [ ] later"],
    },
  ]);
});

test("trimSection returns absolute body indices of rolled todo lines", () => {
  // bodyOffset lets the caller turn per-section indices back into absolute file indices
  const section = {
    preamble: ["- [ ] p1"],                                  // absIdx 0
    subsections: [
      { heading: "### a", headingLevel: 3, body: ["- [ ] a1"] },  // heading at absIdx 2, body[0] absIdx 3
    ],
  };
  // preambleStartIndex=0, heading-line occupies its own abs index between preamble and sub-body
  // We pass bodyMap: array of absolute indices parallel to the flat line stream.
  const result = trimSection(section, {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  // We don't test absolute indices in this test — those are produced by performSectionRollover.
  // Here we only verify structure.
  expect(result.section.preamble).toEqual(["- [ ] p1"]);
  expect(result.section.subsections[0].body).toEqual(["- [ ] a1"]);
});

test("trimSection returns total rolled count", () => {
  const section = {
    preamble: ["- [ ] p", "some text"],
    subsections: [
      {
        heading: "### a",
        headingLevel: 3,
        body: ["- [ ] a1", "- [ ] a2", "- [x] a3"],
      },
      { heading: "### b", headingLevel: 3, body: [] },
    ],
  };
  const { rolledCount } = trimSection(section, {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  // 1 (preamble todo) + 2 (sub-section a, excluding done) = 3
  expect(rolledCount).toBe(3);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — `trimSection` not exported.

- [ ] **Step 3: Implement `trimSection`**

Append to `src/rollover-section.js`:

```javascript
// Trim a parsed Section tree. Returns a new tree (old tree is not mutated) plus
// a running count of unfinished todos carried forward.
//
//   trimSection(section, opts) -> { section: trimmedSection, rolledCount: number }
export function trimSection(section, opts) {
  const preambleResult = trimBodyLines(section.preamble, opts);
  let rolledCount = preambleResult.rolledLineIndices.length;

  const subsections = section.subsections.map((sub) => {
    const subResult = trimBodyLines(sub.body, opts);
    rolledCount += subResult.rolledLineIndices.length;
    return {
      heading: sub.heading,
      headingLevel: sub.headingLevel,
      body: subResult.kept,
    };
  });

  return {
    section: { preamble: preambleResult.kept, subsections },
    rolledCount,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: trimSection applies trim rules to preamble and sub-sections"
```

---

## Task 7: Merge trimmed yesterday section into today's section

**Files:**
- Modify: `src/rollover-section.js`
- Modify: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `mergeSection`**

Append to `src/rollover-section.test.js`:

```javascript
import { mergeSection } from "./rollover-section";

test("mergeSection appends matching sub-sections at the bottom of today's body", () => {
  const yesterday = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] y1"] },
    ],
  };
  const today = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] t1"] },
    ],
  };
  const merged = mergeSection(yesterday, today, { leadingNewLine: false });
  expect(merged.subsections).toEqual([
    { heading: "### asap", headingLevel: 3, body: ["- [ ] t1", "- [ ] y1"] },
  ]);
});

test("mergeSection creates new sub-section when today lacks a match", () => {
  const yesterday = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] y1"] },
      { heading: "### ad-hoc", headingLevel: 3, body: ["- [ ] y2"] },
    ],
  };
  const today = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: [] },
    ],
  };
  const merged = mergeSection(yesterday, today, { leadingNewLine: false });
  expect(merged.subsections).toEqual([
    { heading: "### asap", headingLevel: 3, body: ["- [ ] y1"] },
    { heading: "### ad-hoc", headingLevel: 3, body: ["- [ ] y2"] },
  ]);
});

test("mergeSection appends yesterday's preamble to today's preamble", () => {
  const yesterday = {
    preamble: ["y-pre"],
    subsections: [],
  };
  const today = {
    preamble: ["t-pre"],
    subsections: [],
  };
  const merged = mergeSection(yesterday, today, { leadingNewLine: false });
  expect(merged.preamble).toEqual(["t-pre", "y-pre"]);
});

test("mergeSection with leadingNewLine=true inserts a blank before appended content", () => {
  const yesterday = {
    preamble: ["y-pre"],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] y1"] },
    ],
  };
  const today = {
    preamble: ["t-pre"],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] t1"] },
    ],
  };
  const merged = mergeSection(yesterday, today, { leadingNewLine: true });
  expect(merged.preamble).toEqual(["t-pre", "", "y-pre"]);
  expect(merged.subsections[0].body).toEqual(["- [ ] t1", "", "- [ ] y1"]);
});

test("mergeSection with leadingNewLine=true skips blank when today side is empty", () => {
  const yesterday = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] y1"] },
    ],
  };
  const today = {
    preamble: [],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: [] },
    ],
  };
  const merged = mergeSection(yesterday, today, { leadingNewLine: true });
  expect(merged.subsections[0].body).toEqual(["- [ ] y1"]);
});

test("mergeSection preserves heading level of yesterday-only sub-section", () => {
  const yesterday = {
    preamble: [],
    subsections: [
      { heading: "#### deep-only-in-yesterday", headingLevel: 4, body: ["- [ ] y"] },
    ],
  };
  const today = { preamble: [], subsections: [] };
  const merged = mergeSection(yesterday, today, { leadingNewLine: false });
  expect(merged.subsections).toEqual([
    { heading: "#### deep-only-in-yesterday", headingLevel: 4, body: ["- [ ] y"] },
  ]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — `mergeSection` not exported.

- [ ] **Step 3: Implement `mergeSection`**

Append to `src/rollover-section.js`:

```javascript
function headingKey(line) {
  return (line || "").replace(/\s+$/, "");
}

// Merge yesterday's trimmed section into today's parsed section.
// - Append yesterday's preamble to today's preamble.
// - For each yesterday sub-section, find today's matching sub-section (exact heading
//   match after trimming trailing whitespace). If found, append body at bottom of
//   today's body. If not found, append the full sub-section to the end of today's list.
// - leadingNewLine=true inserts a blank line before appended content (but not when
//   today's target is empty).
export function mergeSection(yesterday, today, opts) {
  const { leadingNewLine } = opts;

  const appendBody = (existing, incoming) => {
    if (incoming.length === 0) return existing.slice();
    if (existing.length === 0) return incoming.slice();
    if (leadingNewLine) return [...existing, "", ...incoming];
    return [...existing, ...incoming];
  };

  const merged = {
    preamble: appendBody(today.preamble, yesterday.preamble),
    subsections: today.subsections.map((s) => ({
      heading: s.heading,
      headingLevel: s.headingLevel,
      body: s.body.slice(),
    })),
  };

  const todayIndexByKey = new Map();
  merged.subsections.forEach((sub, idx) => {
    todayIndexByKey.set(headingKey(sub.heading), idx);
  });

  for (const ySub of yesterday.subsections) {
    const key = headingKey(ySub.heading);
    if (todayIndexByKey.has(key)) {
      const idx = todayIndexByKey.get(key);
      merged.subsections[idx].body = appendBody(
        merged.subsections[idx].body,
        ySub.body
      );
    } else {
      merged.subsections.push({
        heading: ySub.heading,
        headingLevel: ySub.headingLevel,
        body: ySub.body.slice(),
      });
      todayIndexByKey.set(key, merged.subsections.length - 1);
    }
  }

  return merged;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 17 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: mergeSection combines yesterday and today trees by matching sub-headers"
```

---

## Task 8: Serialize a Section tree back into lines

**Files:**
- Modify: `src/rollover-section.js`
- Modify: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `serializeSection`**

Append to `src/rollover-section.test.js`:

```javascript
import { serializeSection } from "./rollover-section";

test("serializeSection round-trips a tree back into lines", () => {
  const section = {
    preamble: ["intro", ""],
    subsections: [
      { heading: "### asap", headingLevel: 3, body: ["- [ ] a"] },
      { heading: "### week", headingLevel: 3, body: ["- [ ] b", ""] },
    ],
  };
  expect(serializeSection(section)).toEqual([
    "intro",
    "",
    "### asap",
    "- [ ] a",
    "### week",
    "- [ ] b",
    "",
  ]);
});

test("serializeSection with empty preamble and one sub-section", () => {
  const section = {
    preamble: [],
    subsections: [{ heading: "### only", headingLevel: 3, body: ["- [ ] x"] }],
  };
  expect(serializeSection(section)).toEqual(["### only", "- [ ] x"]);
});

test("serializeSection with only preamble", () => {
  const section = { preamble: ["just text"], subsections: [] };
  expect(serializeSection(section)).toEqual(["just text"]);
});

test("serializeSection of fully empty section returns empty array", () => {
  expect(serializeSection({ preamble: [], subsections: [] })).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — `serializeSection` not exported.

- [ ] **Step 3: Implement `serializeSection`**

Append to `src/rollover-section.js`:

```javascript
// Flatten a Section tree back into an array of lines, preserving order.
// Does not include the section's own delimiting heading — the caller splices
// these lines between the heading line and the section's end in the file.
export function serializeSection(section) {
  const out = [...section.preamble];
  for (const sub of section.subsections) {
    out.push(sub.heading);
    for (const line of sub.body) {
      out.push(line);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 21 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: serializeSection flattens a Section tree back to lines"
```

---

## Task 9: Compute the yesterday-file rewrite (for `deleteOnComplete`)

**Files:**
- Modify: `src/rollover-section.js`
- Modify: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `removeRolledFromYesterday`**

Append to `src/rollover-section.test.js`:

```javascript
import { removeRolledFromYesterday } from "./rollover-section";

test("removeRolledFromYesterday removes unfinished todo lines, keeps headers and completed todos", () => {
  const content = [
    "# Daily",
    "",
    "## Rollover",
    "### asap",
    "- [x] done",
    "- [ ] open1",
    "    - [ ] open1-child",
    "### later",
    "- [ ] open2",
    "## Notes",
    "keep me",
  ].join("\n");

  const opts = {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  };

  const result = removeRolledFromYesterday(content, "## Rollover", opts);
  expect(result).toBe(
    [
      "# Daily",
      "",
      "## Rollover",
      "### asap",
      "- [x] done",
      "### later",
      "## Notes",
      "keep me",
    ].join("\n")
  );
});

test("removeRolledFromYesterday with rolloverChildren=false leaves children of unfinished todos in place", () => {
  const content = [
    "## Rollover",
    "- [ ] parent",
    "    - [ ] child",
    "    note",
  ].join("\n");

  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: false,
    removeEmptyTodos: false,
  });
  expect(result).toBe(
    ["## Rollover", "    - [ ] child", "    note"].join("\n")
  );
});

test("removeRolledFromYesterday returns content unchanged when heading not found", () => {
  const content = "# Title\n- [ ] orphan\n";
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  expect(result).toBe(content);
});

test("removeRolledFromYesterday also removes empty unfinished todos when removeEmptyTodos=true", () => {
  const content = ["## Rollover", "- [ ] ", "- [ ] real"].join("\n");
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: true,
  });
  expect(result).toBe("## Rollover");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — `removeRolledFromYesterday` not exported.

- [ ] **Step 3: Implement `removeRolledFromYesterday`**

Append to `src/rollover-section.js` (add the import at the top of the file as well):

First, add at the top of `src/rollover-section.js`:

```javascript
import { locateSection } from "./get-section";
```

Then append to the end:

```javascript
// Given a full file content string and a section heading, return the content
// with the rolled-over unfinished todo lines (and their children, if rolloverChildren)
// removed from inside the section. Non-todo lines, sub-headers, and completed todos are preserved.
//
// Used when the `deleteOnComplete` setting is on. If the section heading cannot be found,
// returns the input unchanged.
export function removeRolledFromYesterday(fileContent, headingLine, opts) {
  const lines = fileContent.split(/\r?\n/);
  const loc = locateSection(lines, headingLine);
  if (!loc) return fileContent;

  const sectionStart = loc.headingIndex + 1;
  const body = lines.slice(sectionStart, loc.endIndex);
  const { rolledLineIndices } = trimBodyLines(body, opts);

  const removeSet = new Set(rolledLineIndices.map((i) => i + sectionStart));
  const kept = lines.filter((_, idx) => !removeSet.has(idx));

  return kept.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 25 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: removeRolledFromYesterday strips unfinished rolled todos from yesterday"
```

---

## Task 10: Orchestrator `performSectionRollover` (pure, no Obsidian API)

**Files:**
- Modify: `src/rollover-section.js`
- Modify: `src/rollover-section.test.js`

- [ ] **Step 1: Write failing tests for `performSectionRollover`**

Append to `src/rollover-section.test.js`:

```javascript
import { performSectionRollover } from "./rollover-section";

const baseOpts = {
  doneStatusMarkers: "xX-",
  rolloverChildren: true,
  removeEmptyTodos: false,
  leadingNewLine: false,
  deleteOnComplete: false,
};

test("performSectionRollover end-to-end merges section content correctly", () => {
  const yesterday = [
    "# 2026-04-13",
    "",
    "## Rollover",
    "### asap",
    "- [x] done yesterday",
    "- [ ] open yesterday",
    "    - [ ] child",
    "### this week",
    "- [ ] week1",
    "",
    "## Notes",
    "notes stay here",
  ].join("\n");

  const today = [
    "# 2026-04-14",
    "",
    "## Rollover",
    "### asap",
    "### this week",
    "",
    "## Notes",
    "",
  ].join("\n");

  const result = performSectionRollover(yesterday, today, "## Rollover", baseOpts);
  expect(result.status).toBe("ok");
  expect(result.rolledCount).toBe(2);
  expect(result.newTodayContent).toBe(
    [
      "# 2026-04-14",
      "",
      "## Rollover",
      "### asap",
      "- [ ] open yesterday",
      "    - [ ] child",
      "### this week",
      "- [ ] week1",
      "",
      "## Notes",
      "",
    ].join("\n")
  );
  expect(result.newYesterdayContent).toBeNull();
});

test("performSectionRollover returns status=missing-yesterday when yesterday has no section", () => {
  const yesterday = "# Yesterday\n- [ ] stray\n";
  const today = "# Today\n## Rollover\n";
  const result = performSectionRollover(yesterday, today, "## Rollover", baseOpts);
  expect(result.status).toBe("missing-yesterday");
  expect(result.newTodayContent).toBeNull();
  expect(result.newYesterdayContent).toBeNull();
});

test("performSectionRollover returns status=missing-today when today has no section", () => {
  const yesterday = "## Rollover\n- [ ] thing\n";
  const today = "# Today\n(no section heading)\n";
  const result = performSectionRollover(yesterday, today, "## Rollover", baseOpts);
  expect(result.status).toBe("missing-today");
  expect(result.newTodayContent).toBeNull();
  expect(result.newYesterdayContent).toBeNull();
});

test("performSectionRollover with deleteOnComplete returns updated yesterday content", () => {
  const yesterday = [
    "## Rollover",
    "### asap",
    "- [x] done",
    "- [ ] rolled",
    "## Notes",
  ].join("\n");
  const today = ["## Rollover", "### asap", "## Notes"].join("\n");

  const result = performSectionRollover(yesterday, today, "## Rollover", {
    ...baseOpts,
    deleteOnComplete: true,
  });
  expect(result.status).toBe("ok");
  expect(result.newYesterdayContent).toBe(
    ["## Rollover", "### asap", "- [x] done", "## Notes"].join("\n")
  );
});

test("performSectionRollover creates yesterday-only sub-section on today's side", () => {
  const yesterday = [
    "## Rollover",
    "### existing",
    "- [ ] a",
    "### extra",
    "- [ ] b",
  ].join("\n");
  const today = ["## Rollover", "### existing"].join("\n");

  const result = performSectionRollover(yesterday, today, "## Rollover", baseOpts);
  expect(result.newTodayContent).toBe(
    [
      "## Rollover",
      "### existing",
      "- [ ] a",
      "### extra",
      "- [ ] b",
    ].join("\n")
  );
});

test("performSectionRollover is a no-op (0 rolled) when yesterday section has no open todos or content", () => {
  const yesterday = ["## Rollover", "### asap", "- [x] done"].join("\n");
  const today = ["## Rollover", "### asap"].join("\n");
  const result = performSectionRollover(yesterday, today, "## Rollover", baseOpts);
  expect(result.status).toBe("ok");
  expect(result.rolledCount).toBe(0);
  // today's content may still be rewritten (structurally equivalent). Verify structural result.
  expect(result.newTodayContent).toBe(["## Rollover", "### asap"].join("\n"));
});

test("performSectionRollover with leadingNewLine inserts blank before appended content", () => {
  const yesterday = [
    "## Rollover",
    "### asap",
    "- [ ] y1",
  ].join("\n");
  const today = [
    "## Rollover",
    "### asap",
    "- [ ] t1",
  ].join("\n");

  const result = performSectionRollover(yesterday, today, "## Rollover", {
    ...baseOpts,
    leadingNewLine: true,
  });
  expect(result.newTodayContent).toBe(
    ["## Rollover", "### asap", "- [ ] t1", "", "- [ ] y1"].join("\n")
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: FAIL — `performSectionRollover` not exported.

- [ ] **Step 3: Implement `performSectionRollover`**

Append to `src/rollover-section.js` (and update the top imports):

Update the imports at the top of `src/rollover-section.js` to:

```javascript
import { getTodoStatus, getIndent } from "./todo-utils";
import { locateSection, parseSectionBody } from "./get-section";
```

Then append:

```javascript
// Pure orchestrator: no Obsidian API calls. Given yesterday and today file contents as
// strings, return a result describing what to do.
//
//   performSectionRollover(yesterdayContent, todayContent, headingLine, opts)
//     -> {
//       status: "ok" | "missing-yesterday" | "missing-today",
//       newTodayContent: string | null,
//       newYesterdayContent: string | null,  // populated only if deleteOnComplete and status === "ok"
//       rolledCount: number,                 // 0 if status !== "ok"
//     }
//
// The caller (src/index.js) is responsible for writing the files and showing notices.
export function performSectionRollover(yesterdayContent, todayContent, headingLine, opts) {
  const yLines = yesterdayContent.split(/\r?\n/);
  const tLines = todayContent.split(/\r?\n/);

  const yLoc = locateSection(yLines, headingLine);
  if (!yLoc) {
    return {
      status: "missing-yesterday",
      newTodayContent: null,
      newYesterdayContent: null,
      rolledCount: 0,
    };
  }
  const tLoc = locateSection(tLines, headingLine);
  if (!tLoc) {
    return {
      status: "missing-today",
      newTodayContent: null,
      newYesterdayContent: null,
      rolledCount: 0,
    };
  }

  const yBody = yLines.slice(yLoc.headingIndex + 1, yLoc.endIndex);
  const tBody = tLines.slice(tLoc.headingIndex + 1, tLoc.endIndex);

  const ySection = parseSectionBody(yBody, yLoc.level);
  const tSection = parseSectionBody(tBody, tLoc.level);

  const { section: yTrimmed, rolledCount } = trimSection(ySection, opts);
  const mergedToday = mergeSection(yTrimmed, tSection, opts);
  const serialized = serializeSection(mergedToday);

  const before = tLines.slice(0, tLoc.headingIndex + 1);
  const after = tLines.slice(tLoc.endIndex);
  const newTodayContent = [...before, ...serialized, ...after].join("\n");

  let newYesterdayContent = null;
  if (opts.deleteOnComplete) {
    newYesterdayContent = removeRolledFromYesterday(
      yesterdayContent,
      headingLine,
      opts
    );
    // If nothing was removed, don't rewrite the file.
    if (newYesterdayContent === yesterdayContent) {
      newYesterdayContent = null;
    }
  }

  return {
    status: "ok",
    newTodayContent,
    newYesterdayContent,
    rolledCount,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/rollover-section.test.js`
Expected: PASS — all 32 tests green.

- [ ] **Step 5: Run the whole test suite to confirm nothing else broke**

Run: `pnpm test`
Expected: PASS — all tests green across `get-todos.test.js`, `todo-utils.test.js`, `get-section.test.js`, `rollover-section.test.js`.

- [ ] **Step 6: Commit**

```bash
git add src/rollover-section.js src/rollover-section.test.js
git commit -m "feat: performSectionRollover orchestrates end-to-end section rollover"
```

---

## Task 11: Integrate into plugin — rewrite `rollover()` in `src/index.js`

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Replace the top imports**

Edit `src/index.js`. Replace lines 1-10 (imports + `MAX_TIME_SINCE_CREATION` + stray comment) with:

```javascript
import { Notice, Plugin } from "obsidian";
import {
  getDailyNoteSettings,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";
import UndoModal from "./ui/UndoModal";
import RolloverSettingTab from "./ui/RolloverSettingTab";
import { performSectionRollover } from "./rollover-section";

const MAX_TIME_SINCE_CREATION = 5000; // 5 seconds
```

(Removes the `getTodos` import — no longer used — and the unused `createRepresentationFromHeadings` comment block.)

- [ ] **Step 2: Remove the now-dead helper methods**

Delete these methods from the class:
- `getAllUnfinishedTodos(file)` (lines ~124-133 in the current file)
- `sortHeadersIntoHierarchy(file)` (lines ~135-145)

Keep everything else (`loadSettings`, `saveSettings`, `isDailyNotesEnabled`, `getLastDailyNote`, `getFileMoment`, `getCleanFolder`, `onload`).

- [ ] **Step 3: Rewrite the `rollover(file)` method body**

Replace the entire `rollover(file = undefined) { ... }` method with:

```javascript
  async rollover(file = undefined) {
    let { folder, format } = getDailyNoteSettings();
    let ignoreCreationTime = false;

    if (file == undefined) {
      const allDailyNotes = getAllDailyNotes();
      file = getDailyNote(window.moment(), allDailyNotes);
      ignoreCreationTime = true;
    }
    if (!file) return;

    folder = this.getCleanFolder(folder);

    if (!file.path.startsWith(folder)) return;

    const today = new Date();
    const todayFormatted = window.moment(today).format(format);
    const filePathConstructed = `${folder}${
      folder == "" ? "" : "/"
    }${todayFormatted}.${file.extension}`;
    if (filePathConstructed !== file.path) return;

    if (
      today.getTime() - file.stat.ctime > MAX_TIME_SINCE_CREATION &&
      !ignoreCreationTime
    ) {
      return;
    }

    if (!this.isDailyNotesEnabled()) {
      new Notice(
        "RolloverTodosPlugin unable to rollover unfinished todos: Please enable Daily Notes, or Periodic Notes (with daily notes enabled).",
        10000
      );
      return;
    }

    const {
      templateHeading,
      deleteOnComplete,
      removeEmptyTodos,
      rolloverChildren,
      doneStatusMarkers,
      leadingNewLine,
    } = this.settings;

    if (!templateHeading || templateHeading === "none") {
      new Notice(
        "Rollover Daily Todos: set a rollover section heading in plugin settings to enable rollover.",
        8000
      );
      return;
    }

    const lastDailyNote = this.getLastDailyNote();
    if (!lastDailyNote) return;

    const yesterdayContent = await this.app.vault.read(lastDailyNote);
    const todayContent = await this.app.vault.read(file);

    const result = performSectionRollover(
      yesterdayContent,
      todayContent,
      templateHeading,
      {
        doneStatusMarkers,
        rolloverChildren,
        removeEmptyTodos,
        leadingNewLine,
        deleteOnComplete,
      }
    );

    if (result.status === "missing-yesterday") {
      new Notice(
        `Rollover: section heading "${templateHeading}" not found in yesterday's note (${lastDailyNote.basename}). Nothing rolled over.`,
        8000
      );
      return;
    }
    if (result.status === "missing-today") {
      new Notice(
        `Rollover: section heading "${templateHeading}" not found in today's note. Add it to your daily note template to enable rollover.`,
        8000
      );
      return;
    }

    const undoHistoryInstance = {
      previousDay: { file: undefined, oldContent: "" },
      today: { file: undefined, oldContent: "" },
    };

    if (result.newTodayContent !== null && result.newTodayContent !== todayContent) {
      undoHistoryInstance.today = { file, oldContent: todayContent };
      await this.app.vault.modify(file, result.newTodayContent);
    }

    if (result.newYesterdayContent !== null) {
      undoHistoryInstance.previousDay = {
        file: lastDailyNote,
        oldContent: yesterdayContent,
      };
      await this.app.vault.modify(lastDailyNote, result.newYesterdayContent);
    }

    const rolled = result.rolledCount;
    const message =
      rolled === 0
        ? `Rollover ran — no unfinished todos found in "${templateHeading}".`
        : `Rolled over ${rolled} todo${rolled === 1 ? "" : "s"} into "${templateHeading}".`;
    new Notice(message, 4000 + message.length * 3);

    this.undoHistoryTime = new Date();
    this.undoHistory = [undoHistoryInstance];
  }
```

- [ ] **Step 4: Build the plugin to confirm the rewrite compiles**

Run: `pnpm run build`
Expected: PASS — Rollup emits `main.js` with no errors.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all existing tests still green. No new tests for `rollover()` itself (it's Obsidian-API-dependent; the pure logic is covered in Task 10).

- [ ] **Step 6: Commit**

```bash
git add src/index.js
git commit -m "feat: rewrite rollover() to use section-based pipeline"
```

---

## Task 12: Update settings UI copy

**Files:**
- Modify: `src/ui/RolloverSettingTab.js:36-53` (template heading setting)
- Modify: `src/ui/RolloverSettingTab.js:55-67` (delete-on-complete setting)

- [ ] **Step 1: Update the `templateHeading` setting label and description**

Edit `src/ui/RolloverSettingTab.js`. Replace:

```javascript
    new Setting(this.containerEl)
      .setName("Template heading")
      .setDesc("Which heading from your template should the todos go under")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ...templateHeadings.reduce((acc, heading) => {
              acc[heading] = heading;
              return acc;
            }, {}),
            none: "None",
          })
          .setValue(this.plugin?.settings.templateHeading)
          .onChange((value) => {
            this.plugin.settings.templateHeading = value;
            this.plugin.saveSettings();
          })
      );
```

with:

```javascript
    new Setting(this.containerEl)
      .setName("Rollover section heading")
      .setDesc(
        "The heading that delimits the rollover section on both yesterday's and today's daily notes. Everything inside this section (sub-headers, todos, notes) is copied to today's note when a new daily note is created, with completed todos and their nested content left behind. Example: '## Rollover'. The section ends at the next heading of equal or higher level; sub-headers inside (e.g. '### asap', '### this week') are preserved. Unfinished todos are merged under matching sub-headers on today's note, or appended as new sub-headers if today doesn't have them yet."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            ...templateHeadings.reduce((acc, heading) => {
              acc[heading] = heading;
              return acc;
            }, {}),
            none: "None",
          })
          .setValue(this.plugin?.settings.templateHeading)
          .onChange((value) => {
            this.plugin.settings.templateHeading = value;
            this.plugin.saveSettings();
          })
      );
```

- [ ] **Step 2: Update the `deleteOnComplete` setting description**

Edit `src/ui/RolloverSettingTab.js`. Replace the `setDesc(...)` argument of the "Delete todos from previous day" setting with:

```javascript
      .setDesc(
        "Removes rolled unfinished todos from yesterday's rollover section after they are copied to today's note. Sub-headers, completed todos, and non-todo text remain on yesterday's note. Enabling this is destructive — use the undo command within 2 minutes if you need to revert."
      )
```

- [ ] **Step 3: Build to confirm nothing broke**

Run: `pnpm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/ui/RolloverSettingTab.js
git commit -m "docs(settings): update copy for section-based rollover"
```

---

## Task 13: Version bump

**Files:**
- Modify: `manifest.json:3`
- Modify: `package.json:3`
- Modify: `versions.json` (append entry)

- [ ] **Step 1: Bump `manifest.json`**

Edit `manifest.json`. Change `"version": "1.2.0"` to `"version": "1.3.0"`.

- [ ] **Step 2: Bump `package.json`**

Edit `package.json`. Change `"version": "1.2.0"` to `"version": "1.3.0"`.

- [ ] **Step 3: Add entry to `versions.json`**

Edit `versions.json`. Add a new line before the closing `}`:

```json
  "1.2.0": "0.12.12",
  "1.3.0": "0.12.12"
}
```

(Replace the existing `"1.2.0": "0.12.12"` line with both lines above, keeping the trailing comma only on the first.)

- [ ] **Step 4: Commit**

```bash
git add manifest.json package.json versions.json
git commit -m "chore: bump version to 1.3.0"
```

---

## Task 14: README — document new behavior and breaking change

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README to understand its structure**

Run: `cat README.md | head -60`

The file is short and already documents the old flat-rollover behavior. The exact prose update depends on its current structure, but the goal is:

1. Describe section-based rollover as the behavior.
2. Include an example daily-note template.
3. Call out the breaking change for existing users.
4. Update the "Template heading" setting description.

- [ ] **Step 2: Update the README**

Edit `README.md`:

1. Locate the section that describes the "Template heading" / rollover behavior.
2. Replace it with content explaining section-based rollover. Include this example template block:

````markdown
## Example daily-note template

```markdown
# {{date}}

## Rollover
### asap
### this week
### someday

## Notes
```

When a new daily note is created, the plugin finds the `## Rollover` heading on yesterday's note, copies everything inside it (including the `### asap`, `### this week`, and `### someday` sub-headers and any todos beneath them), and merges that content into today's `## Rollover` section. Completed todos and their nested content are left behind on yesterday's note.

## How the section is delimited

- The **rollover section heading** setting names the heading that delimits the section (e.g. `## Rollover`).
- The section begins on the line after that heading.
- The section ends at the next heading of **equal or higher level** — so `## Notes` ends a `## Rollover` section; `### asap` does not. Sub-headers can nest freely inside.
- The first occurrence of the heading on each note is used.

## What rolls over

- Unfinished todos (and their indented children, when "Roll over children of todos" is on).
- Sub-headers (e.g. `### asap`, `### this week`) — preserved so today's note has the same structure.
- Loose text and paragraphs inside the section.

## What does not roll over

- Completed todos (per the "Done status markers" setting).
- Anything indented beneath a completed todo.

## Merge behavior on today's note

- If today's note (from your daily-note template) already has the same sub-header, unfinished todos from yesterday are **appended** at the bottom of today's sub-header.
- If yesterday has a sub-header today doesn't, it's added at the end of today's rollover section.

## Breaking change in 1.3.0

Versions prior to 1.3.0 rolled over every unfinished todo in the previous day's note as a flat list. 1.3.0 replaces this with section-based rollover: the plugin only touches the content inside the configured section heading on both notes.

**To upgrade:**
1. Add a section heading (e.g. `## Rollover`) to your daily-note template.
2. Move the todos you want to roll into that section (optionally under sub-headers like `### asap`).
3. Set "Rollover section heading" in plugin settings to that heading.

If the heading is not set, or is not present on either note, the plugin shows a notice and does nothing.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document section-based rollover and 1.3.0 breaking change"
```

---

## Task 15: Final end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite one more time**

Run: `pnpm test`
Expected: PASS — every test in `todo-utils.test.js`, `get-todos.test.js`, `get-section.test.js`, `rollover-section.test.js` is green.

- [ ] **Step 2: Build the plugin**

Run: `pnpm run build`
Expected: PASS — `main.js` generated cleanly, no Rollup warnings beyond the usual.

- [ ] **Step 3: Manual smoke test in Obsidian (reported, not automated)**

Load the built `main.js`, `manifest.json`, and `versions.json` into an Obsidian test vault's plugin folder. Verify:

1. Create a daily-note template with `## Rollover\n### asap\n### this week\n\n## Notes`.
2. Set the plugin's "Rollover section heading" to `## Rollover`.
3. On yesterday's note, under `### asap`, add `- [ ] task A` and `- [x] done task`.
4. Create today's daily note — confirm `- [ ] task A` appears under `### asap`, `- [x] done task` does not, `## Notes` is untouched.
5. Toggle "Delete todos from previous day" on, do a manual rollover — confirm `- [ ] task A` disappears from yesterday but `- [x] done task` and the sub-headers remain.
6. Trigger "Undo last rollover" within 2 minutes — confirm both notes revert.
7. Remove `## Rollover` from today's note, trigger manual rollover — confirm the "heading not found in today's note" notice appears and no files change.
8. Remove `## Rollover` from yesterday's note, create a new today note — confirm the "heading not found in yesterday's note" notice appears and today's note is untouched.

- [ ] **Step 4: If all manual checks pass, declare done**

If any manual check fails, capture the observed behavior, file an issue / hand back to planning. Do not patch silently.
