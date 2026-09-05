import { FAL_KEYS_URL } from "./config";

export interface Sub {
  num: string;
  /** {noun} is replaced with BOUTIQUE.noun from miris/config.ts. The same
   *  substitution runs over `body`. */
  title: string;
  body: string;
  code?: string;
  /** A snippet id from miris/snippets.mjs. Typed loosely on purpose: the
   *  snippets live in a plain .mjs file, so there is no exported union to
   *  narrow against. */
  fill?: string;
  /** Required whenever `fill` is set. What the button wrote, and why. */
  explain?: string;
  /** Renders an outbound link as a button, for steps that send you somewhere
   *  else to fetch something. Opens in a new tab: losing the guide mid-step
   *  would cost more than the link saves. */
  link?: { href: string; label: string };
  /** Renders the fal panel opener. */
  panel?: boolean;
  /** Renders the Write the label button. */
  label?: boolean;
  /** A check id from the CHECKS map in miris/devApi.ts. Done verifies it before
   *  moving on. Steps whose work happens outside the project, signing up or
   *  deploying, deliberately have none. */
  check?: string;
  /** Renders the html-in-canvas path badge. */
  renderPath?: boolean;
}

export interface Step {
  num: string;
  title: string;
  subs: Sub[];
}

export const STEPS: Step[] = [
  {
    num: "00",
    title: "Doors and keys",
    subs: [
      {
        num: "00.1",
        title: "Open the project",
        body:
          "Everything you build goes in app/stage.tsx. The guide writes between the miris: comments and nowhere else, so anything you add outside them survives every Fill and every Clear. The shell of the room, its props and a published catalog are already on disk, in public/ and miris/.",
        explain:
          "One thing will look wrong and is not: every save of app/stage.tsx reloads the whole page rather than hot-updating it. A Fast Refresh of a mounted stream leaves the SDK's own scene objects behind, measured as two SparkRenderers in one scene with the splats drawn twice and the model smearing as the camera moves. Scoping the reload to \"only when a stream is mounted\" still ghosted on a stream's first mount through an HMR path that localhost never reproduced, so the reload is unconditional. It is cheap because everything durable lives in miris/data.json: your progress, the build tray and an in-flight mesh all come back.",
      },
      {
        num: "00.2",
        title: "Your fal key",
        body:
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Save it, then press Done: the key is read per request, so there is nothing to restart. The image later on costs fractions of a cent, the mesh about $1.40.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
        check: "falKey",
      },
    ],
  },
  {
    num: "01",
    title: "The room",
    subs: [
      {
        num: "01.1",
        title: "Load the room",
        body:
          "The room shell is public/env/room.glb: walls, floor, the niches and the shelf returns. Put this in the block between the miris:room comments and the whole shell arrives as one glTF scene. It arrives unlit -- 01.2 deals with that.",
        fill: "room",
        explain:
          "It is a 15MB download and it behaves like one. Nothing renders until it has arrived and parsed, every visitor pays it once, and the file is the same for all of them. Hold on to that, because chapter 05 puts things on these shelves that do not work like this at all, and the contrast is the point of the workshop. Two glTF notes worth having now: useGLTF caches by URL and suspends, so the room mounts once however many components ask for it, and the export carries geometry and materials but not one photon of the lighting rig it was authored under. Our reference room shipped for weeks with its Blender lights stranded in Blender, because the exporter only ever wrote TEXCOORD_0 and the bake had nowhere to land. Whatever the room looks like now is what three.js does with no lights at all, which is the next step.",
        check: "room",
      },
      {
        num: "01.2",
        title: "Light it",
        body:
          "This adds two things: a wash pair that lifts the whole room, and one cove spot per niche, mounted at the back of the recess near the ceiling and aimed down the back panel rather than at it. Wide angle, heavy penumbra.",
        fill: "lights",
        explain:
          "The cove intensity is a landing value, not a guess. Sampling the back panel against the Blender reference, 18 puts the near-white fraction, meaning pixels over RGB 248 in the upper 60% of the panel, at about 3.5%, which is what the reference render measures. An overshoot test at 28 pushed it to 5.8%: visibly more clipped without reading any brighter. The aim matters as much as the number, because a spot at the niche mouth hot-spots the panel dead on, and the niche interior is travertine, deliberately 15 to 30% less reflective than the plaster wall, so it starts a vitrine at a disadvantage and can read darker than the wall around it. The wash pair is the number you should not copy from us. Our production room runs a HemisphereLight at 0.22 and a DirectionalLight at 0.15, which are that weak only because a baked lightmap on TEXCOORD_1 carries the room's illumination and the pair exists for the two things a lightmap cannot do: feed a specular highlight, since lightmaps only ever reach indirect diffuse, and light the trim and housings that sit outside the bake. This room has no bake, so the pair carries the wash on its own and starts an order of magnitude higher, around where ours sat before the bake existed. Derive yours the same way the cove was derived: raise until the walls read like a lit interior, then check the near-white fraction, because past the landing point the gradients crush toward white rather than getting brighter.",
        check: "lights",
      },
      {
        num: "01.3",
        title: "Fix the metal",
        body:
          "The brass in this room renders nearly black, and the cove spots you just aimed clip to flat white. Neither is a lighting fault, so this block goes at the renderer and the scene: ACES filmic tone mapping at exposure 1.1, and a PMREM of three's own RoomEnvironment as scene.environment at intensity 0.35.",
        fill: "quality",
        explain:
          "Metal shows you what is around it, and until now nothing was. A MeshStandardMaterial at high metalness with no environment map has nothing to reflect and resolves to near-black, which no amount of adding lights repairs, because the lights are not what it samples. RoomEnvironment is a studio's worth of soft boxes generated in a few milliseconds, and 0.35 is deliberately low: enough for brass to read as metal and for stone to pick up a believable ambient response, not enough to wash out the lighting you just landed. Tone mapping is the other half. Under the default NoToneMapping a cove spot clips straight to white instead of rolling off, and exposure 1.1 was tuned with a streamed asset in frame rather than against an empty room. That last detail is the one three.js people are usually surprised by: splats are unlit, they read neither scene.environment nor any THREE.Light, but they do pass through this renderer's tone mapping and exposure, so the exposure you pick for the room is also the exposure you pick for the collection.",
        check: "quality",
      },
    ],
  },
  {
    num: "02",
    title: "Surfaces",
    subs: [
      {
        num: "02.1",
        title: "Choose your materials",
        body:
          "The shell arrives with placeholder surfaces. This block overrides them by mesh name once the glTF has loaded, and it carries two palettes: a vault of dark sci-fi plating and steel, and the warmer boutique it replaced. THEME picks which table is used AND which folder the maps load from, so only the twelve images you are using are ever fetched. The vault palette also builds a ceiling, because room.glb ships none. One rule, and it is not a taste rule: nothing transmissive.",
        fill: "materials",
        explain:
          "That rule has a measured price on it. One glass shelf, a single KHR_materials_transmission material, cost 28.51ms of GPU per frame against 2.54ms for the same room without it, timed with EXT_disjoint_timer_query_webgl2. three renders the entire scene into a transmission buffer once per transmissive object, so what you are buying is a second full scene pass, and it scales with neither the shelf's geometry nor the canvas size: a 16x pixel reduction measured as nothing at all. Replacing that shelf with wood took the reference build from roughly 50ms of GPU in its closest view to roughly 10ms. Frosted glass is worse rather than better, because roughened transmission adds blur taps on top of the pass. And this is a scene that will soon be re-sorting splats every frame, which is the budget the pass would eat. If you want the read of glass, use polished stone or brass and let the environment from 01.3 do the reflecting.",
        check: "materials",
      },
    ],
  },
  {
    num: "03",
    title: "Furniture",
    subs: [
      {
        num: "03.1",
        title: "Dress the room",
        body:
          "Props are in public/props. The vault sets out two armoured container crates, a facing pair of chairs and a cylindrical pod, and tints the door and the counter to steel so their shapes survive the change of room. The boutique fills the same space with eleven warmer pieces instead -- a curved sofa, a marble table, olive trees. THEME picks the list, and it has to match the one you set in 02.1.",
        fill: "props",
        explain:
          "These are files, and they deserve to be. A prop is small, static, identical for every visitor and never inspected up close, which is exactly the profile a GLB download is good at. A capture of the thing you are selling is the opposite on all four counts, and that line is the one decision this workshop is really teaching. Two practical notes while you place them. Load each prop once and reuse the loaded scene rather than fetching per instance. And put things flush to the floor or clearly off it, never a millimetre above it: the reference build had a rug 4mm off the floor and trim 20 to 30mm proud of the walls, and both streaked, which is a depth-precision problem that chapter 05 has to fix at the camera because it cannot be fixed here.",
        check: "props",
      },
    ],
  },
  {
    num: "04",
    title: "The tour",
    subs: [
      {
        num: "04.1",
        title: "Author your stops",
        body:
          "A stop is a camera position and a point to look at. Write yours in the miris:stops block, one per thing worth seeing: the doors as you come in, the counter, each niche. Order is the order you will fly in. The block sits above the return in plain // comments, because that is JavaScript scope, not JSX.",
        code:
          'const STOPS = [\n  { id: "doors", pos: [5.4, 1.6, 0], look: [-1.0, 1.3, -1.6] },\n  { id: "niche", pos: [0, 1.45, -2.0], look: [0, 1.25, -4.3] },\n];',
        explain:
          "Stops are data rather than code because the flight in 04.2 and the idle orbit that parks on the same loop both read them. Two rules of thumb that will save you re-authoring later. Put the look point on the piece rather than on the wall behind it, since a wall-aimed stop centres the frame on nothing. And do not stand too close. A splat capture resolves as you approach it, but there is a distance past which no more detail is coming, and a stop parked inside that distance is the one that will look soft no matter how patient your connection is.",
        check: "stops",
      },
      {
        num: "04.2",
        title: "Fly between them",
        body:
          "This adds the rig that moves the camera from stop to stop, plus the keys and buttons that drive it. It reads STOPS, so the flight is only ever as good as the stops you just wrote.",
        fill: "rail",
        explain:
          "Two things in here are decisions rather than plumbing. The look target interpolates angularly instead of lerping the look point through world space: a point lerp swings the gaze at a non-constant rate, fastest as the point passes closest to the camera, and it reads as a lurch halfway through every flight. And the idle orbit parks exactly on the flight loop rather than at a fixed corner. An earlier version parked at a corner and let the orbit glide onto the loop, which read as the camera creeping forward the instant the page loaded and again after every flight home. Parking on the loop makes that glide degenerate, so the orbit starts with zero snap and you cannot tell where the flight ended and the idle began.",
        check: "rail",
      },
      {
        num: "04.3",
        title: "Tune the flight",
        body:
          "No button for this one. Open app/stage.tsx and edit the numbers in the rail block you just added: how long a flight takes, its easing, and how long the camera settles on arrival. Save and the page reloads with your change; your progress is kept.",
        code: "duration: 1.2, ease: easeInOutCubic, settle: 0.4",
        explain:
          "This is the one set of numbers in the workshop nobody measured for you, because they are a pace rather than a performance constant. There is one hard edge though, and it is the reason the flight exists at all rather than a cut: the flight is the window that streaming hides in. A piece you are flying toward is fetching and decoding for exactly as long as the flight lasts, so a flight tuned much under a second lands you in front of something still coarsening in, and that reads as a bug rather than a choice. Ours travels a little over a second and crossfades detail levels at 150ms, except while travelling, where the crossfade goes to zero: a crossfade draws the outgoing and incoming level at once, so one landing at arrival roughly doubles that stream's splats at precisely the moment the arrival burst is already at its worst.",
      },
    ],
  },
  {
    num: "05",
    title: "The collection",
    subs: [
      {
        num: "05.1",
        title: "Describe your pieces",
        body:
          "Your own {noun}s, three slots. One subject, centred, on a plain backdrop, or press the dice. The image is back in seconds; Submit for 3D takes four to five minutes and about $1.40 on your key, and the tray keeps working while you carry on building. Each finished mesh downloads as a .glb from the tray, and the prompt you write here is what chapter 06 writes the placard from.",
        panel: true,
        check: "image",
        explain:
          "Two things are being steered for you, and both are about what survives reconstruction. The framing line refuses by name everything GPT Image 2 adds when it hears a product brief: colour palette swatches, a scale-reference silhouette, an alternate view in the corner. Meshy reconstructs whatever is in frame, so a concept sheet becomes a mesh of a concept sheet, swatches and all. The dice pool is steered the same way one level down, at the material: every entry names a material and a piece of wear, glaze, patina, oiled grain, worn brass, and not one of them is glass, chrome or mirror. Part of that is capture, since a specular surface has no stable appearance to reconstruct from photographs. Part of it is the rule from 02.1, which does not care how a transmissive material got into your scene.",
      },
      {
        num: "05.2",
        title: "Put them on the shelves",
        body:
          "Six pieces are already published and streaming. miris/catalog.json holds their uuids, names, attributes and prices, along with a viewer key that authorises the streams, so there is nothing to sign up for here. This block mounts one stream per entry into the scene you have been building.",
        fill: "catalog",
        explain:
          "The room cost 15MB and a wait. The six bags cost neither, and nothing else about your app changed to make that true. Same canvas, same camera, same tone mapping, same frame: extend registers the SDK's stream as a JSX tag, so it takes position and scale like any other three.js object and React Three Fiber draws it in the same pass as the walls. What arrives first is a coarse version of the whole piece, sharpening to whatever the view justifies, so no visitor ever waits on a download. Streaming is a delivery change, not a rendering change. That is also why a shop's inventory can turn over weekly while its architecture never does: the room is a build artifact, the collection is a feed. One number comes with mounting six at once. The splat budget seed starts at 250000, set through the SDK's @internal _setSplatCountBudgetOverride, and it is the only quality actuator the published SDK exposes. At a seed of 800k, six streams in an overview shot measured p50 86ms at 736k resident splats; at 250k the same shot measured 16 to 20ms at around 300k, with the engine's own controller still free to grow whichever piece you are looking at to about 476k. Do not go looking for per-stream controls to replace it. Members like stream.maxLod and stream.priority are not in the published package, and assigning one is silent: it creates an inert own property that reports as present through `in`, and the measured cost of exactly that going unnoticed was 795,052 splats instead of 300,000 and 77ms instead of 25ms, with not one console error.",
        check: "catalog",
      },
      {
        num: "05.3",
        title: "Make them fit",
        body:
          "At capture scale a handbag is a thumbnail on a 1.2m shelf, because a published capture is not authored in display units. This adds the one thing 05.2 was missing: the display scale each piece carries in miris/catalog.json.",
        fill: "catalogFit",
        explain:
          "The obvious way to size a stream is to ask it. getBounds() will answer, and that is the trap this step exists to show you. A GLB has bounds the moment it parses; a stream\'s box is built from whatever detail has arrived, so the same piece measures 0.20m one second and 0.50m the next, and it never converges for a piece the camera is not looking at, because refinement follows the camera. A scale divided out of that number lands anywhere between a thumbnail and a wardrobe, and it lands somewhere different on every reload. Two more traps sit behind it. Only the SIZE it reports is usable at all: the centre and min come back in world space against a proxy box that sits at (1 + scale) times the node\'s own position, so placing a piece by them throws it metres outside the room. And if you hide the piece while you measure, every path out of the measurement has to put it back, or the one that gives up leaves it invisible for the life of the page, which is indistinguishable from a stream that never arrived. Measure once, by eye, and ship the number. The anchors in room.glb already say where each niche is, so position comes from inlet0N and size comes from catalog.json, and both are the same on every machine. One renderer fix belongs to this step too, because streamed bounds are what causes it. Pin camera near to 0.1 and far to 60 every frame. The SDK derives them from bounds and had left near at 0.00035 against far 35.39, a 100000:1 ratio that collapses depth precision and z-fights anything sitting millimetres proud, which is what streaked the rug and the trim. Every frame, not once: a single assignment measured as being put straight back the next time bounds arrived.",
        check: "catalogFit",
      },
    ],
  },
  {
    num: "06",
    title: "The placards",
    subs: [
      {
        num: "06.1",
        title: "Write the placards",
        body:
          "Press the button and a model on your fal key turns a {noun}'s prompt into a name, a description and three or four attributes, saved into miris/data.json. The catalog's six already carry theirs, written the same way.",
        label: true,
        check: "card",
        explain:
          "The register is the whole prompt: match the object rather than a house style, write as though it has always existed, no hedging, and never a word about how it was made. The card is written from the piece's persisted prompt rather than from the text in the box, which is the same thing the server checks before it will write one: until an image has actually been generated, a prompt does not exist as far as data.json is concerned. And the reply is stripped of code fences before parsing, because models fence JSON out of habit however firmly they are told not to. A reply that does not parse into the three expected fields asks you to press again rather than writing half a placard.",
      },
      {
        num: "06.2",
        title: "Float HTML over the canvas",
        body:
          "The obvious way to label a 3D thing: position a DOM element over the canvas and move it with the camera. Add this to the miris:card block, then orbit until a bag passes in front of its card.",
        fill: "cardOverlay",
        explain:
          "drei's Html helper does the positioning, projecting a scene position into screen space every frame and moving a real DOM element to match. Watch what it cannot do. The card is over the canvas, not in it, so nothing in your scene can ever pass in front of it, it takes no tone mapping and no fog, and it is missing from any screenshot of the canvas. Six of them also cost six DOM elements transformed per frame, in layout rather than in the render loop, which is the kind of cost that never shows up in a GPU profile and shows up immediately on a phone. That is the ceiling of the overlay approach, and the next two steps go through it rather than around it.",
        check: "cardOverlay",
      },
      {
        num: "06.3",
        title: "Paint HTML into a canvas",
        body:
          "Now the real thing. This goes in the miris:label block above the return, because it calls a hook and hooks run every render: write the placard as plain HTML, and useHtmlTexture hands back a three.js texture.",
        fill: "labelHtml",
        renderPath: true,
        explain:
          "HTML-in-Canvas is the browser capability this step exists to teach: ctx.drawElementImage() draws a laid-out DOM element straight into a 2D canvas, pixels and all. Chrome ships it behind chrome://flags/#canvas-draw-element, and the badge above says which path actually ran, read from the module that did the drawing rather than re-detected, because detection can say yes and the call can still throw. Everywhere else the same markup is serialised into an SVG foreignObject and drawn as an image. Two implementation details are load-bearing and easy to get wrong yourself: the element is parked offscreen with a large negative left rather than display:none, because an unrendered element never paints and the native call needs a paint snapshot, and on the native path it has to live inside the very canvas it is drawn onto, with the layoutsubtree attribute. Either path ends as pixels in a 2D canvas that an ordinary CanvasTexture samples, which is the whole trick: anything HTML can lay out, the scene can wear. Scale is fixed at 0.0045 scene units per CSS pixel, so a 200px card comes out 0.9 units wide, which is what the overlay in 06.2 read as at the same position and distance.",
        check: "labelHtml",
      },
      {
        num: "06.4",
        title: "Put it on a plane",
        body:
          "Swap the overlay in the miris:card block for a plane wearing that texture, inside a Billboard so it turns to face you. Orbit again: a bag now passes in front of its placard, because the placard is geometry.",
        fill: "labelMesh",
        renderPath: true,
        explain:
          "A plane with a meshBasicMaterial, nothing exotic. Billboard turns it to the camera every frame the way every game nameplate works, and without it a plane is invisible edge-on and gone entirely from behind, because single-sided geometry culls its back face. transparent honours the rounded corners, toneMapped false keeps the text out of the ACES curve you set in 01.3, and the width and height come back from the hook already in scene units. Your HTML is now a surface in the world: occluded by the collection, lit by the same exposure, in every screenshot. Then try to select the text. You cannot, and that is the trade. HTML-in-Canvas normally keeps a drawn element selectable, focusable and readable by a screen reader, because the canvas showing it is the canvas holding it, so the browser can map a hit region onto it. A Billboard gives it nothing to map: the plane turns as you orbit, hides behind a bag and moves whenever the camera does. The pixels are the placard now, and the DOM that made them is parked offscreen. 06.2 was the other end of the same trade, selectable and never once behind anything. Neither is the right answer for every label, and a boutique usually wants both: the placard in the niche as geometry, the price and the buy button as overlay.",
        check: "labelMesh",
      },
    ],
  },
  {
    num: "07",
    title: "Out the door",
    subs: [
      {
        num: "07.1",
        title: "Ship it",
        body:
          "Two things, because the first makes this panel disappear. Comment out the MirisGuide line in app/main.tsx: the guide goes, your boutique stays exactly as you built it, and the styling stays too, since index.html loads it. Then build, deploy, and send the link to someone in the room. The room downloads once. The collection does not download at all.",
        code: "{/* <MirisGuide /> */}",
      },
    ],
  },
];
