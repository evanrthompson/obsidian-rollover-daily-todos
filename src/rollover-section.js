import { getTodoStatus, getIndent } from "./todo-utils";
import { locateSection } from "./get-section";

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

// Remove rolled (unfinished, non-empty) todos from yesterday's section in the raw file
// content string. Only lines that would be carried forward into today (i.e. lines
// included in rolledLineIndices by trimBodyLines) are deleted. Completed todos,
// non-todo lines, sub-headings, and empty todos dropped by removeEmptyTodos all
// remain in yesterday's file.
//
// Returns the modified content string. If the heading is not found, returns content
// unchanged.
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
