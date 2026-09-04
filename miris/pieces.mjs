/* The piece shape, in the one module both sides can import.

   It lives here rather than in store.mjs because store.mjs reaches for
   node:fs/promises, so a browser module cannot take these from it without
   dragging node builtins into the bundle. Keeping a second copy in the client
   was worse than the import it avoided: a field added to emptyPiece would
   quietly stop being cleared on a track change, with nothing anywhere to report
   it.

   Nothing in this file may import from node:. */

/* Three fixed slots, never grown. pieces[i] is niche.0{i+1}, so a piece that
   arrives late lands in its own niche instead of shifting the others along. */
export const PIECE_IDS = ["01", "02", "03"];

export const emptyPiece = (id) => ({
  id,
  // empty | generating-image | image-ready | generating-mesh | mesh-ready
  // | uploaded | streaming | failed
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
