import { expect, test } from "vitest";
import { trimBodyLines, trimSection, mergeSection, serializeSection, removeRolledFromYesterday, performSectionRollover } from "./rollover-section";

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

test("removeRolledFromYesterday removes unfinished rolled todos, keeps completed and non-todo lines", () => {
  const content = ["## Rollover", "- [x] done", "some note", "- [ ] real"].join("\n");
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  // completed todo and non-todo line stay; unfinished todo is removed (it was rolled)
  expect(result).toBe(["## Rollover", "- [x] done", "some note"].join("\n"));
});

test("removeRolledFromYesterday returns content unchanged when heading not found", () => {
  const content = ["## Other", "- [ ] real"].join("\n");
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  expect(result).toBe(content);
});

test("removeRolledFromYesterday removes rolled todo and its children when rolloverChildren=true", () => {
  const content = ["## Rollover", "- [ ] parent", "    - [ ] child"].join("\n");
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: false,
  });
  expect(result).toBe("## Rollover");
});

test("removeRolledFromYesterday with removeEmptyTodos=true leaves empty todos in place (they weren't rolled)", () => {
  const content = ["## Rollover", "- [ ] ", "- [ ] real"].join("\n");
  const result = removeRolledFromYesterday(content, "## Rollover", {
    doneStatusMarkers: "xX-",
    rolloverChildren: true,
    removeEmptyTodos: true,
  });
  // "- [ ] real" gets rolled → removed from yesterday.
  // "- [ ] " is dropped by removeEmptyTodos → stays on yesterday (it wasn't rolled).
  expect(result).toBe(["## Rollover", "- [ ] "].join("\n"));
});

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
