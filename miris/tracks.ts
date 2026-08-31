export interface Track {
  id: string;
  label: string;
  tagline: string;
  noun: string;
  /** Miris kit ramp, used as the panel accent for this track. */
  accent: string;
  accentInk: string;
  /** Specimen render for the track chooser, under public/. Rendered on a pure
   *  black ground with no alpha, which is why the chooser screen-blends it:
   *  the artwork's black becomes the page's own ground. Replacing one of these
   *  only works with art on a black ground. */
  image: string;
  /** Short, plain description of the render. The door already carries the
   *  track's name and tagline as text, so this stays brief rather than
   *  repeating them. */
  imageAlt: string;
  /** Intrinsic size of `image`, so the chooser reserves space and nothing
   *  shifts as the three loads land. */
  imageWidth: number;
  imageHeight: number;
  /** Placeholder for the prompt field. */
  hint: string;
  /** Prepended to the prompt before it reaches fal. */
  style: string;
  /** What the curator writes for this track. */
  curates: string;
}

export const TRACKS: Track[] = [
  {
    id: "summon",
    label: "Summon",
    tagline: "Creatures on a circle. Heat, fur, membrane.",
    noun: "creature",
    accent: "#FF3500",
    accentInk: "#08090D",
    image: "/tracks/summon.webp",
    imageAlt: "A faceted crystal dragon perched on a plinth",
    imageWidth: 900,
    imageHeight: 756,
    hint: "a moss-covered lantern beast with too many eyes",
    style: "a fantasy creature for a monster-taming game, matte painted-resin surfaces, chunky readable silhouette",
    curates: "a rarity, two abilities and a line of lore",
  },
  {
    id: "atelier",
    label: "Atelier",
    tagline: "Goods on a plinth. Materials carry the story.",
    noun: "piece",
    accent: "#FF9500",
    accentInk: "#08090D",
    image: "/tracks/atelier.webp",
    imageAlt: "A chrome sneaker with an iridescent side panel",
    imageWidth: 900,
    imageHeight: 756,
    hint: "a brushed-steel pour-over kettle with a walnut handle",
    style: "a crafted retail product, studio product photograph, accurate materials, soft even light",
    curates: "materials, provenance and an edition",
  },
  {
    id: "reliquary",
    label: "Reliquary",
    tagline: "Holdings under glass. Provenance is the interface.",
    noun: "holding",
    accent: "#00D5FF",
    accentInk: "#08090D",
    image: "/tracks/reliquary.webp",
    imageAlt: "A marble figure standing on a stepped plinth",
    imageWidth: 900,
    imageHeight: 1125,
    hint: "a bronze astrolabe engraved with wave patterns",
    style: "a museum artifact, aged surfaces, patina and wear, neutral backdrop, even light",
    curates: "a date, a place and a provenance",
  },
];

export const trackById = (id: string | undefined) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
