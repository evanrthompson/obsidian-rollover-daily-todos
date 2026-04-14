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
