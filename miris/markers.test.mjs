import { test } from "node:test";
import assert from "node:assert/strict";
import { listMarkers, replaceMarker } from "./markers.mjs";

const file = [
  "const a = 1;",
  "  {/* miris:scene-start */}",
  "  old body",
  "  {/* miris:scene-end */}",
  "const b = 2;",
].join("\n");

test("replaces only the text between the markers", () => {
  const out = replaceMarker(file, "scene", "  new body");
  assert.match(out, /new body/);
  assert.doesNotMatch(out, /old body/);
  assert.match(out, /const a = 1;/);
  assert.match(out, /const b = 2;/);
});

test("keeps the markers themselves", () => {
  const out = replaceMarker(file, "scene", "x");
  assert.match(out, /miris:scene-start/);
  assert.match(out, /miris:scene-end/);
});

test("is idempotent", () => {
  const once = replaceMarker(file, "scene", "x");
  assert.equal(replaceMarker(once, "scene", "x"), once);
});

test("survives the file having been reformatted around the markers", () => {
  const reflowed = file.replace("const a = 1;", "const a = 1;\n\n// my own note");
  const out = replaceMarker(reflowed, "scene", "x");
  assert.match(out, /my own note/);
});

test("throws on an unknown marker", () => {
  assert.throws(() => replaceMarker(file, "nope", "x"), /nope/);
});

test("lists the markers present", () => {
  assert.deepEqual(listMarkers(file), ["scene"]);
});

test("keeps the closing marker's indentation", () => {
  const out = replaceMarker(file, "scene", "  x");
  assert.match(out, /\n {2}\{\/\* miris:scene-end \*\/\}/);
});
