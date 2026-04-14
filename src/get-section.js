// Match an ATX heading: one or more '#' then a space then any content.
// Returns 0 if line is not a heading, else the heading level (1-6).
export function headingLevel(line) {
  if (typeof line !== "string") return 0;
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
