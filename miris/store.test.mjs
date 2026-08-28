import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_DATA, readData, writeData } from "./store.mjs";

const fresh = () => mkdtemp(join(tmpdir(), "miris-store-"));

test("returns defaults when nothing has been written", async () => {
  assert.deepEqual(await readData(await fresh()), DEFAULT_DATA);
});

test("a patch merges rather than replacing", async () => {
  const dir = await fresh();
  await writeData(dir, { prompt: "a beast" });
  await writeData(dir, { uuid: "abc" });
  const data = await readData(dir);
  assert.equal(data.prompt, "a beast");
  assert.equal(data.uuid, "abc");
});

test("writes leave a parseable file behind", async () => {
  const dir = await fresh();
  await writeData(dir, { prompt: "x" });
  const raw = await readFile(join(dir, "data.json"), "utf8");
  assert.doesNotThrow(() => JSON.parse(raw));
});

test("a corrupt file throws instead of silently resetting the session", async () => {
  const dir = await fresh();
  await writeData(dir, { prompt: "x" });
  await writeFile(join(dir, "data.json"), '{"prompt": "x');
  await assert.rejects(() => readData(dir), /data\.json/);
});

test("concurrent writes do not drop each other's fields", async () => {
  const dir = await fresh();
  await Promise.all([
    writeData(dir, { prompt: "a beast" }),
    writeData(dir, { imageUrl: "http://img" }),
    writeData(dir, { step: "2.4" }),
  ]);
  const data = await readData(dir);
  assert.equal(data.prompt, "a beast");
  assert.equal(data.imageUrl, "http://img");
  assert.equal(data.step, "2.4");
});
