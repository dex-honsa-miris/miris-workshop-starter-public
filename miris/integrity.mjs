import { start, end } from "./markers.mjs";

/* Three failure modes this catches, all of which are silent or fatal at
   runtime rather than at author time:
     - a fill id missing from PARTS crashes the whole sidebar, because
       Step.tsx calls dedent(PARTS[sub.fill]) and nothing wraps <MirisGuide />;
     - a check id missing from CHECKS silently passes, because devApi returns
       { done: true } when it cannot find one;
     - a marker missing or out of order in either stage file makes Fill throw
       and Clear report "unknown marker".
   Object.hasOwn, not truthiness: CLEARS_TO legitimately stores null. */
export function checkIntegrity({ subs, snippets, parts, clearsTo, markerFor, checks, files }) {
  const problems = [];
  const maps = [
    ["SNIPPETS", snippets],
    ["PARTS", parts],
    ["CLEARS_TO", clearsTo],
    ["MARKER_FOR", markerFor],
  ];

  for (const sub of subs) {
    if (sub.fill) {
      for (const [name, map] of maps) {
        if (!Object.hasOwn(map, sub.fill)) {
          problems.push(`step ${sub.num}: fill "${sub.fill}" is missing from ${name}`);
        }
      }
    }
    if (sub.check && !Object.hasOwn(checks, sub.check)) {
      problems.push(`step ${sub.num}: check "${sub.check}" is missing from CHECKS`);
    }
  }

  const markers = [...new Set(Object.values(markerFor))];
  for (const [path, source] of Object.entries(files)) {
    for (const marker of markers) {
      const a = source.indexOf(start(marker));
      const b = source.indexOf(end(marker));
      if (a === -1) problems.push(`${path}: no start comment for marker "${marker}"`);
      else if (b === -1) problems.push(`${path}: no end comment for marker "${marker}"`);
      else if (b < a) problems.push(`${path}: marker "${marker}" ends before it starts`);
    }
  }

  return problems;
}
