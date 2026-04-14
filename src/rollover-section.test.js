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
