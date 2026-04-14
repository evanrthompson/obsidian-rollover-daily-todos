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
