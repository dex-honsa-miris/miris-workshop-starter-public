export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

export const IMAGE_MODEL = "openai/gpt-image-2";
/* Meshy reconstructs everything in frame, so the render must be the asset and
 * nothing else. GPT Image 2 reads "fantasy creature" as an invitation to
 * concept-sheet furniture: palette swatches, a scale-figure silhouette, a
 * side-view thumbnail, all of which end up in the mesh. Refuse each by name. */
export const IMAGE_FRAMING =
  "Render exactly one subject, whole body centered and fully in frame, on a plain seamless studio backdrop. " +
  "No text, no labels, no color palette swatches, no scale-reference silhouettes or human figures, " +
  "no alternate views or thumbnails, no props. A single clean reference render, not a concept sheet.";
export const MODEL_3D = "meshy/v7/image-to-3d";
export const LABEL_MODEL = "openrouter/router";
export const LABEL_LLM = "google/gemini-2.5-flash";
export const PORTAL_URL = "https://app.miris.com";
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";

// Authorises every stream. Cold start is 6 to 9s; warming it early does not help.
export const JWKS_URL = "https://app.miris.com/.well-known/jwks.json";

/* The one house. This replaced three parallel tracks and the door chooser that
 * picked between them: the workshop is a single flow now, so the noun, the
 * style prefix and the prompt pool are constants rather than a lookup, and no
 * handler branches on which house an attendee is in. */
export const BOUTIQUE = {
  /** The word the curriculum's {noun} placeholder resolves to, and the word the
   *  curator is told the object is. Matches `pieces` in data.json, which is
   *  what every slot has been called since before this was one house. */
  noun: "piece",

  /** Prepended to the prompt before it reaches fal, for the image and again for
   *  the mesh's texture pass. */
  style:
    "a crafted object from a boutique maker, studio product photograph, accurate material and wear, soft even light",

  /** Placeholder for the prompt field. */
  hint: "a bridle-leather weekend bag with solid brass hardware",

  /** Pool for the dice on the prompt field. Subject phrases only, in the same
   *  register as `hint`: `style` is prepended, so a prompt that names its own
   *  lighting or backdrop fights the prefix.
   *
   *  Weighted toward what splats reconstruct well, and away from what they
   *  fight with. Every entry names a material and a piece of wear: glaze,
   *  patina, oiled grain, worn brass. Nothing here is glass, chrome or mirror,
   *  and that is a renderer constraint rather than a taste one. A transmissive
   *  material makes three render the whole scene into a transmission buffer
   *  once per object, measured at 28.51ms GPU against 2.54ms without. */
  prompts: [
    "a canvas messenger bag with bridle-leather straps and brass hardware",
    "a saddle-stitched card wallet in tan vegetable-tanned leather",
    "a leather camera strap with a worn brass slide buckle",
    "a ribbed ceramic tumbler glazed in matte oxblood",
    "a wide stoneware serving bowl with an unglazed clay rim",
    "a salt-glazed jug with a mottled grey shoulder",
    "a hammered copper moka pot with a bakelite grip",
    "a brushed-steel pour-over kettle with a walnut handle",
    "a beechwood plane with a pitted iron blade",
  ],
};

/* The SDK defaults to dev.miris.com. Every viewer key we ship authorises
   app.miris.com, so this is set on globalThis in app/main.tsx before the first
   render, which is before the engine's first request. */
export const MIRIS_SERVER = "https://app.miris.com/viewer/v1";
