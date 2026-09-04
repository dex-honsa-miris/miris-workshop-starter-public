export interface Track {
  id: string;
  label: string;
  /** One line on the door: what you make, then what the label adds. Two-part
   *  rhythm, sentence case, no em-dashes. Kept short because the chooser has to
   *  fit a 2/3-width preview pane at 720px tall. */
  blurb: string;
  noun: string;
  /** Miris kit ramp, used as the panel accent for this house. Each one picks up
   *  something actually visible in that house's door art, so the panel and the
   *  door read as the same place. */
  accent: string;
  /** Specimen render for the house chooser, under public/. Rendered on a pure
   *  black ground with no alpha, which is why the chooser screen-blends it:
   *  the artwork's black becomes the page's own ground. Replacing one of these
   *  only works with art on a black ground.
   *
   *  All three share one illustration language: a single object in three
   *  quarter view, white rim-light tracing every contour, fine speckle inside
   *  the surfaces, one prismatic accent panel, one four-point sparkle. A
   *  replacement that drops those reads as a different site. */
  image: string;
  /** Short, plain description of the render. The door already carries the
   *  house name and blurb as text, so this stays brief rather than
   *  repeating them. */
  imageAlt: string;
  /** Intrinsic size of `image`, so the chooser reserves space and nothing
   *  shifts as the three loads land. */
  imageWidth: number;
  imageHeight: number;
  /** object-position for the door's crop, which is portrait. All three renders
   *  are landscape, so under object-fit: cover they scale to the door height
   *  and only `x` moves the crop. `y` is inert here for every house, and is
   *  written as 50% rather than left out so the pair reads as coordinates. */
  focal: string;
  /** object-position for the sidebar strip, which is a ~3.8:1 band and needs
   *  its own value. Reusing `focal` there cropped the old statue render to a
   *  headless torso. Here the landscape renders scale to exactly the strip
   *  width, so the axes swap: only `y` does anything. */
  focalStrip: string;
  /** Placeholder for the prompt field. */
  hint: string;
  /** Pool for the dice on the prompt field. Subject phrases only, in the same
   *  register as `hint`: the API prepends `style`, so a prompt that names its
   *  own lighting or backdrop fights the prefix.
   *
   *  Weighted toward what splats reconstruct well, and away from what they
   *  fight with. Every entry names a material and a piece of wear: glaze,
   *  patina, oiled grain, worn brass. Nothing here is glass, chrome or mirror,
   *  and that is a renderer constraint rather than a taste one. A transmissive
   *  material makes three render the whole scene into a transmission buffer
   *  once per object, measured at 28.51ms GPU against 2.54ms without. */
  prompts: string[];
  /** Prepended to the prompt before it reaches fal. */
  style: string;
  /** Seeds the MATERIALS record the attendee edits at step 02.2. Each surface
   *  slot names a material set we host, not a bundled file: WebContainer drops
   *  binary assets on import, so nothing textural can ship in the repo. */
  palette: { walls: string; shelves: string; floor: string; counter: string };
}

export const TRACKS: Track[] = [
  {
    id: "atelier",
    label: "Atelier",
    blurb: "You make a leather piece. The house writes its materials and edition.",
    noun: "piece",
    accent: "#FF9500",
    image: "/tracks/atelier.webp",
    imageAlt: "A chrome sneaker with an iridescent side panel",
    imageWidth: 900,
    imageHeight: 756,
    focal: "56% 50%",
    focalStrip: "50% 40%",
    hint: "a bridle-leather weekend bag with solid brass hardware",
    prompts: [
      "a canvas messenger bag with bridle-leather straps and brass hardware",
      "a cork-soled leather sandal with a hand-stitched welt",
      "a waxed-cotton field cap with antique brass eyelets",
      "a saddle-stitched card wallet in tan vegetable-tanned leather",
      "a felted wool desk tray with saddle-stitched edges",
      "a leather camera strap with a worn brass slide buckle",
      "a rolled leather tool wrap darkened at the fold",
      "a shearling-lined glove with a hand-turned seam",
    ],
    style:
      "a crafted leather good from a luxury house, studio product photograph, accurate grain and stitching, soft even light",
    palette: {
      walls: "plaster-warm-limewash",
      shelves: "walnut-oiled",
      floor: "travertine-honed",
      counter: "brass-aged",
    },
  },
  {
    id: "kiln",
    label: "Kiln",
    blurb: "You make a vessel. The house writes its glaze, its date and its edition.",
    noun: "vessel",
    accent: "#00D5FF",
    image: "/tracks/kiln.webp",
    imageAlt: "A ribbed stoneware pitcher with a pooling matte glaze",
    imageWidth: 900,
    imageHeight: 675,
    focal: "46% 50%",
    focalStrip: "50% 42%",
    hint: "a ribbed stoneware pitcher with a glaze pooling at the foot",
    prompts: [
      "a ribbed ceramic tumbler glazed in matte oxblood",
      "a wide stoneware serving bowl with an unglazed clay rim",
      "a fired-clay oil lamp with a soot-blackened lip",
      "a salt-glazed jug with a mottled grey shoulder",
      "a raku tea bowl with a crackled cream glaze",
      "a porcelain pour-over cone with a hand-trimmed foot",
      "a terracotta planter chalked white with mineral bloom",
      "a celadon vase with a crazed surface and a thick rim",
    ],
    style:
      "a thrown ceramic vessel from a pottery house, studio product photograph, accurate glaze and clay body, soft even light",
    palette: {
      walls: "plaster-cool-grey",
      shelves: "ash-pale",
      floor: "terracotta-unglazed",
      counter: "soapstone-honed",
    },
  },
  {
    id: "bench",
    label: "Bench",
    blurb: "You make a tool. The house writes its metal, its maker and its edition.",
    noun: "tool",
    accent: "#FF3500",
    image: "/tracks/bench.webp",
    imageAlt: "A gooseneck kettle in blackened steel with an ash handle",
    imageWidth: 900,
    imageHeight: 675,
    focal: "48% 50%",
    focalStrip: "50% 52%",
    hint: "a gooseneck kettle in blackened steel with a turned ash handle",
    prompts: [
      "a hammered copper moka pot with a bakelite grip",
      "a knurled titanium fountain pen with a smoked resin cap",
      "a brushed-steel pour-over kettle with a walnut handle",
      "a cast-iron skillet with a polished cooking surface",
      "a machinist's caliper in worn nickel with an oiled case",
      "a bronze mortar and pestle dulled by use",
      "a beechwood plane with a pitted iron blade",
      "a blackened steel candle snuffer with a copper collar",
    ],
    style:
      "a worked metal tool from a maker's bench, studio product photograph, accurate patina and machining, soft even light",
    palette: {
      walls: "concrete-board-formed",
      shelves: "oak-fumed",
      floor: "slate-cleft",
      counter: "copper-patinated",
    },
  },
];

export const trackById = (id: string | undefined) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
