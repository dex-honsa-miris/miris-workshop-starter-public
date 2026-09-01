const start = (m) => `{/* miris:${m}-start */}`;
const end = (m) => `{/* miris:${m}-end */}`;

export function replaceMarker(source, marker, body) {
  const a = source.indexOf(start(marker));
  const b = source.indexOf(end(marker));
  if (a === -1 || b === -1 || b < a) throw new Error(`marker not found: ${marker}`);
  const head = source.slice(0, a + start(marker).length);
  // The whitespace before the closing marker belongs to the marker's own line,
  // not to the body, so it has to be put back or the marker slides to column 0.
  const lineStart = source.lastIndexOf("\n", b) + 1;
  const indent = /^[ \t]*$/.test(source.slice(lineStart, b)) ? source.slice(lineStart, b) : "";
  const tail = source.slice(b);
  return `${head}\n${body}\n${indent}${tail}`;
}

/** The attendee's own code for one marker, so a check reads their block rather
 *  than the whole file and cannot be fooled by an import or a comment. */
export function readMarker(source, marker) {
  const a = source.indexOf(start(marker));
  const b = source.indexOf(end(marker));
  if (a === -1 || b === -1 || b < a) return "";
  return source.slice(a + start(marker).length, b);
}

export function listMarkers(source) {
  return [...source.matchAll(/\{\/\* miris:([a-z-]+)-start \*\/\}/g)].map((m) => m[1]);
}
