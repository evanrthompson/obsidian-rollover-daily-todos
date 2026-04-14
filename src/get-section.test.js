import { expect, test } from "vitest";
import { locateSection, parseSectionBody } from "./get-section";

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
