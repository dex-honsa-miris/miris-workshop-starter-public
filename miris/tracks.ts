export interface Track {
  id: string;
  label: string;
  /** One line on the door: what you make, then what the agent adds. Two-part
   *  rhythm, sentence case, no em-dashes. Kept short because the chooser has to
   *  fit a 2/3-width preview pane at 720px tall. */
  blurb: string;
  noun: string;
  /** Miris kit ramp, used as the panel accent for this track. */
  accent: string;
  /** Specimen render for the track chooser, under public/. Rendered on a pure
   *  black ground with no alpha, which is why the chooser screen-blends it:
   *  the artwork's black becomes the page's own ground. Replacing one of these
   *  only works with art on a black ground. */
  image: string;
  /** Short, plain description of the render. The door already carries the
   *  track name and blurb as text, so this stays brief rather than
   *  repeating them. */
  imageAlt: string;
  /** Intrinsic size of `image`, so the chooser reserves space and nothing
   *  shifts as the three loads land. */
  imageWidth: number;
  imageHeight: number;
  /** object-position for the door's crop, which is portrait. Two of the renders
   *  are landscape, so a centre crop loses the subject: the dragon's head sits
   *  upper-left and a centre crop shows mostly wing.
   *
   *  Note which component actually does anything, it differs per render. Under
   *  object-fit: cover only the overflowing axis responds. Reliquary's 900x1125
   *  scales to exactly the door height, so its `y` is inert and only `x` moves
   *  the crop. The two landscape renders are the other way round. */
  focal: string;
  /** object-position for the sidebar strip, which is a ~3.8:1 band and needs
   *  its own value. Reusing `focal` there cropped the statue to a headless
   *  torso: at that band height 38% lands on the midsection, while the head
   *  sits around 3-13% of the image. Here the landscape renders scale to
   *  exactly the strip width, so for those only `y` does anything. */
  focalStrip: string;
  /** Placeholder for the prompt field. */
  hint: string;
  /** Prepended to the prompt before it reaches fal. */
  style: string;
}

export const TRACKS: Track[] = [
  {
    id: "summon",
    label: "Summon",
    blurb: "You make a creature. An agent gives it a rarity, two abilities and a line of lore.",
    noun: "creature",
    accent: "#FF3500",
    image: "/tracks/summon.webp",
    imageAlt: "A faceted crystal dragon perched on a plinth",
    imageWidth: 900,
    imageHeight: 756,
    focal: "14% 32%",
    focalStrip: "50% 20%",
    hint: "a moss-covered lantern beast with too many eyes",
    style: "a fantasy creature for a monster-taming game, matte painted-resin surfaces, chunky readable silhouette",
  },
  {
    id: "atelier",
    label: "Atelier",
    blurb: "You make a product. An agent writes its materials and edition number.",
    noun: "product",
    accent: "#FF9500",
    image: "/tracks/atelier.webp",
    imageAlt: "A chrome sneaker with an iridescent side panel",
    imageWidth: 900,
    imageHeight: 756,
    focal: "56% 46%",
    focalStrip: "50% 40%",
    hint: "a brushed-steel pour-over kettle with a walnut handle",
    style: "a crafted retail product, studio product photograph, accurate materials, soft even light",
  },
  {
    id: "reliquary",
    label: "Reliquary",
    blurb: "You make an artifact. An agent gives it a date, a place and a provenance.",
    noun: "artifact",
    accent: "#00D5FF",
    image: "/tracks/reliquary.webp",
    imageAlt: "A marble figure standing on a stepped plinth",
    imageWidth: 900,
    imageHeight: 1125,
    focal: "50% 26%",
    focalStrip: "50% 10%",
    hint: "a bronze astrolabe engraved with wave patterns",
    style: "a museum artifact, aged surfaces, patina and wear, neutral backdrop, even light",
  },
];

export const trackById = (id: string | undefined) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
