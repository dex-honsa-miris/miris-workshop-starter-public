import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_DATA = {
  track: "",
  step: "1.1",
  prompt: "",
  imageUrl: "",
  falRequestId: "",
  glb: "",
  // Epoch ms while a mesh build is in flight, 0 otherwise. How a reloaded page
  // knows to resume the building state instead of re-offering the review.
  modelStartedAt: 0,
  uuid: "",
  viewerKey: "",
  card: null,
};

const file = (dir) => join(dir, "data.json");

export async function readData(dir) {
  let raw;
  try {
    raw = await readFile(file(dir), "utf8");
  } catch {
    return { ...DEFAULT_DATA };
  }
  try {
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch (e) {
    throw new Error(`data.json is corrupt and was not overwritten: ${e.message}`);
  }
}

// Writes are queued, because a read-modify-write races: pressing Fill chains a
// save while an in-flight image request completes, and the later rename would
// drop the other's field. The tmp path is unique so two overlapping writes can
// never tear the same file.
let queue = Promise.resolve();

export function writeData(dir, patch) {
  const run = queue.then(() => doWrite(dir, patch));
  queue = run.catch(() => undefined);
  return run;
}

async function doWrite(dir, patch) {
  const next = { ...(await readData(dir)), ...patch };
  const tmp = `${file(dir)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2));
  await rename(tmp, file(dir));
  return next;
}
