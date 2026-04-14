import { expect, test } from "vitest";
import { trimBodyLines, trimSection, mergeSection, serializeSection } from "./rollover-section";

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

test("trimSection preserves section structure (just verifies shape)", () => {
  const section = {
    preamble: ["- [ ] p1"],
    subsections: [
      { heading: "### a", headingLevel: 3, body: ["- [ ] a1"] },
    ],
  };
  const result = trimSection(section, {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
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
