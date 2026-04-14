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
//   - `kept` = lines to carry forward into today's note (in order, with dropped subtrees excised)
//   - `rolledLineIndices` = indices into the INPUT `lines` of unfinished-todo lines (and
//     optionally their children) — used to remove them from yesterday when
//     deleteOnComplete is on.
//
// Rules:
//   - Empty unfinished todo (incl. malformed `- [  ]`):
//       - If removeEmptyTodos is on, drop the line + its children (by indent).
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
