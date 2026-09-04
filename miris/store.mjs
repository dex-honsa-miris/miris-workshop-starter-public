import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PIECE_IDS, emptyPiece } from "./pieces.mjs";

/* Re-exported, not redefined. The shape lives in pieces.mjs so the browser can
   have it too, and every existing importer still reaches it through here. */
export { PIECE_IDS, emptyPiece };

export const DEFAULT_DATA = {
  step: "00.1",
  // Per account, not per piece.
  viewerKey: "",
};

/* A function, not a constant: a shared pieces array would be copied by
   reference into every readData fallback. */
const defaults = () => ({ ...DEFAULT_DATA, pieces: PIECE_IDS.map(emptyPiece) });

const file = (dir) => join(dir, "data.json");

/* A stored pieces array from an older shape, a hand-edit, or a truncated write
   must not reach the app as anything but three well-formed slots. */
function normalise(stored) {
  const base = defaults();
  const merged = { ...base, ...stored };
  const found = Array.isArray(stored?.pieces) ? stored.pieces : [];
  merged.pieces = PIECE_IDS.map((id) => ({
    ...emptyPiece(id),
    ...(found.find((p) => p && p.id === id) ?? {}),
    id,
  }));
  return merged;
}

export async function readData(dir) {
  let raw;
  try {
    raw = await readFile(file(dir), "utf8");
  } catch {
    return defaults();
  }
  try {
    return normalise(JSON.parse(raw));
  } catch (e) {
    throw new Error(`data.json is corrupt and was not overwritten: ${e.message}`);
  }
}

// Writes are queued, because a read-modify-write races: pressing Fill chains a
// save while an in-flight image request completes, and the later rename would
// drop the other's field. The tmp path is unique so two overlapping writes can
// never tear the same file.
let queue = Promise.resolve();

const enqueue = (job) => {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
};

export function writeData(dir, patch) {
  return enqueue(async () => persist(dir, { ...(await readData(dir)), ...patch }));
}

/* The reason this exists rather than callers patching `pieces` themselves:
   writeData merges one level, so a caller would have to send the whole array,
   and that array was read before its turn in the queue. Three fal submits
   landing together would each carry a pieces they read while all three were
   empty, and two would lose the only handle a reloaded page has. Reading
   inside the queued job is what makes the merge serialised with the write. */
export function writePiece(dir, id, patch) {
  return enqueue(async () => {
    const cur = await readData(dir);
    const pieces = cur.pieces.map((p) => (p.id === id ? { ...p, ...patch } : p));
    return persist(dir, { ...cur, pieces });
  });
}

async function persist(dir, next) {
  const tmp = `${file(dir)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2));
  await rename(tmp, file(dir));
  return next;
}
