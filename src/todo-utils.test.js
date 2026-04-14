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
