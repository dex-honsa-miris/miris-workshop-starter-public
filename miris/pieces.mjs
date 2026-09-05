/* The piece shape, in the one module both sides can import.

   It lives here rather than in store.mjs because store.mjs reaches for
   node:fs/promises, so a browser module cannot take these from it without
   dragging node builtins into the bundle. Keeping a second copy in the client
   was worse than the import it avoided: a field added to emptyPiece would
   quietly stop being cleared when a slot is reset, with nothing anywhere to
   report it.

   Nothing in this file may import from node:. */

/* Three fixed slots, never grown. pieces[i] is niche.0{i+1}, so a piece that
   arrives late lands in its own niche instead of shifting the others along. */
export const PIECE_IDS = ["01", "02", "03"];

export const emptyPiece = (id) => ({
  id,
  // empty | image-ready | generating-mesh | mesh-ready | failed
  //
  // Every value here has a real writer in devApi.ts, alongside the write that
  // already carries its result: image-ready and failed land with the write
  // that produced them, generating-mesh piggybacks on the fal recorder that
  // already stamps falRequestId/modelStartedAt. Left out rather than named
  // and ignored: generating-image (image generation has no disk-tracked
  // in-flight state to resume into, unlike the mesh build, so a reload mid
  // generation just loses it and nothing ever needs to read this back),
  // uploaded (no upload step exists yet) and streaming (nothing streams a
  // piece onto the shelf yet). Add whichever of these once its producer does.
  status: "empty",
  prompt: "",
  imageUrl: "",
  falRequestId: "",
  // Epoch ms while a mesh build is in flight, 0 otherwise. How a reloaded page
  // knows to resume the building state instead of re-offering the review.
  modelStartedAt: 0,
  glb: "",
  uuid: "",
  card: null,
});
