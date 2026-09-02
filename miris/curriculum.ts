import { FAL_KEYS_URL, PORTAL_URL } from "./config";

export interface Sub {
  num: string;
  /** {noun} is replaced with the track's own word: creature, product,
   *  artifact. The same substitution runs over `body`. */
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
    num: "01",
    title: "Set up",
    subs: [
      {
        num: "1.1",
        title: "Your fal key",
        body:
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Save it, then press Done: the server reads the key on every request, so there is nothing to restart.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
        check: "falKey",
      },
      {
        num: "1.2",
        title: "Describe your {noun}",
        body:
          "One subject, centered, on a plain backdrop. Or press the dice.",
        panel: true,
        check: "image",
      },
    ],
  },
  {
    num: "02",
    title: "Build the stage",
    subs: [
      {
        num: "2.1",
        title: "The pedestal",
        body:
          "Everything needs a floor and something to stand on it. Open app/stage.tsx, find the block between the two miris:scene comments, and put this inside it. Everything you write outside those comments is left alone.",
        fill: "pedestal",
        explain:
          "Two meshes. A cylinder for the plinth, tapered slightly wider at the base, and a thin torus for the bright rim. The rim uses meshBasicMaterial, which ignores lighting entirely, so it reads as a crisp edge no matter what the environment does. Nothing here is a Miris idea yet: this is plain three.js through React Three Fiber.",
        check: "pedestal",
      },
      {
        num: "2.2",
        title: "Sky and light",
        body:
          "One line, and the whole scene changes. Add it under the pedestal, inside the same miris:scene block, and watch what happens to the plinth.",
        fill: "environment",
        explain:
          "An HDR image lights the scene from every direction at once, which is what makes a surface look like it is in a real room rather than under a lamp. It lights the pedestal, not the stream: splats arrive with their lighting baked in at capture, so the environment's whole job is making the furniture look like it belongs in the same room as the asset. The intensity is 1.6 rather than the 0.6 a normal scene wants, because this canvas renders in linear colour space, which darkens everything else.",
        check: "environment",
      },
      {
        num: "2.3",
        title: "Make your Miris account",
        body:
          "You are one step from streaming, and streaming needs an account. Sign up at app.miris.com now, while the mesh builds; when the tray says Model ready, download the .glb and upload it there. Processing takes a few minutes of its own, so the earlier it starts the better. You need two things from the portal afterwards, at step 4: the asset uuid and a viewer key.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "2.4",
        title: "Your first stream",
        body:
          "Add this last, under the Environment line. It streams our demo asset so you can see the thing working before yours is ready; yours goes in at step 4.",
        fill: "stream",
        explain:
          "A stream is not a file you load, it is a subscription. What appears first is a coarse version of the whole asset, and it sharpens as more arrives, so there is never a moment where you wait on a download. The extend call at the top of app/stage.tsx is what buys you that: it registers MirisStream as a JSX tag, so the stream takes position and scale like any other three.js object and React Three Fiber draws it in the same pass as the pedestal. There is no viewer to embed and no render loop to hand over. The args array is React Three Fiber convention, not ours: whatever it holds is passed to new MirisStream(...), which is why swapping the uuid later rebuilds the stream. The position and scale numbers are measured for the demo asset; yours will need its own, at step 4.4.",
        check: "stream",
      },
    ],
  },
  {
    num: "03",
    title: "Make it yours",
    subs: [
      {
        num: "3.1",
        title: "Move the camera",
        body:
          "No button for this one. Open app/stage.tsx and find the camera prop on Canvas. position is [x, y, z] in world units, and the pedestal top is at y 0.5, so [0, 1.5, 3.4] is roughly eye level and a little back. Try [0, 0.8, 2.2] for a low hero angle, or raise fov from 40 to 60 and watch the perspective stretch. Save and the page reloads with your change; your progress is kept.",
        code: "camera={{ position: [0, 1.5, 3.4], fov: 40 }}",
      },
    ],
  },
  {
    num: "04",
    title: "Go live",
    subs: [
      {
        num: "4.1",
        title: "Upload your model",
        body:
          "You started this at step 2.3. Back in the Miris portal, check your upload has finished processing, then copy two values: the asset uuid from the asset page, and a viewer key from your account settings. The viewer key is what lets a browser read your asset without logging anyone in.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "4.2",
        title: "Point the stream at your asset",
        body:
          "Open app/stage.tsx and find the mirisStream you added at step 2.4. Replace the uuid string with your asset id, and the viewerKey string with your key from the portal. Save, and the page reloads streaming your asset. This is the whole integration: one component, two strings.",
        code: 'args={[{\n  uuid: "your-asset-id",\n  viewerKey: "your-viewer-key",\n}]}',
        check: "streamUuid",
      },
      {
        num: "4.3",
        title: "Watch the swap",
        body:
          "It already happened when you saved: your own asset is streaming onto the same pedestal, through the same camera, carrying its own light. Splats are baked at capture, so it arrives already lit.",
        explain:
          "Nothing about your scene changed except where the geometry comes from. The pedestal, the environment, the camera and the render loop are identical. That is the whole point of this workshop: streaming is a delivery change, not a rendering change. You did not load a file that happened to be big. You subscribed to something that arrives at whatever detail the view justifies.",
      },
      {
        num: "4.4",
        title: "Sit it on the plinth",
        body:
          "Yours will not land where the demo asset did. Open app/stage.tsx and edit the position and scale on mirisStream until it sits on the rim. Change scale first, then the middle number of position to drop it onto the surface, then the outer two to centre it. The pedestal top is at y 0.5. Save and the page reloads with your change; your progress is kept.",
        code: "position={[0.043, 0.64, 0.221]} scale={0.138}",
        explain:
          "You are doing this by eye because there is nothing better to compute it from. The SDK will report a bounding box, but it describes the octree cell holding your asset rather than the asset itself, so its floor is not where your model starts. Three numbers you can see the effect of beat a fit that is right for some assets and quietly wrong for others.",
      },
    ],
  },
  {
    num: "05",
    title: "Ship it",
    subs: [
      {
        num: "5.1",
        title: "Write the label",
        body:
          "Press the button and a model on your fal key turns your prompt into a name, a description and a few attributes, saved to miris/data.json.",
        label: true,
        check: "card",
      },
      {
        num: "5.2",
        title: "Float HTML over the canvas",
        body:
          "The obvious way to label a 3D thing: absolutely-position a DOM element over the canvas and move it with the camera. Add this to the miris:card block and orbit until your model passes in front of the card.",
        fill: "card",
        explain:
          "drei's Html helper does the positioning: it projects a scene position into screen space every frame and moves a real DOM element to match. Notice what it cannot do: the card is OVER the canvas, not in it, so your model can never pass in front of the label, the label never reflects or fogs, and it vanishes from screenshots of the canvas. That is the ceiling of the overlay approach, and the next two steps go through it.",
        check: "cardOverlay",
      },
      {
        num: "5.3",
        title: "Paint HTML into a canvas",
        body:
          "Now the real thing. This goes in the miris:label block near the top of app/stage.tsx, above the return: write your label as plain HTML, and useHtmlTexture hands back a texture.",
        fill: "labelHtml",
        explain:
          "HTML-in-Canvas is the new browser capability this step exists to teach: ctx.drawElementImage() draws a laid-out DOM element straight into a 2D canvas, pixels and all. Chrome ships it behind chrome://flags/#canvas-draw-element. Everywhere else, the same markup is serialised into an SVG foreignObject and drawn as an image, which is the fallback the badge below reports. Either way the canvas becomes an ordinary three.js CanvasTexture, and that is the whole trick: anything HTML can lay out, the scene can wear.",
        renderPath: true,
        check: "labelHtml",
      },
      {
        num: "5.4",
        title: "Put it on a plane",
        body:
          "Swap the overlay in the miris:card block for a plane that wears the texture, inside a Billboard so it turns to face you. Orbit again: your model now passes in front of the label, because the label is geometry.",
        fill: "labelMesh",
        explain:
          "A plane with a meshBasicMaterial, nothing exotic. Billboard turns it to the camera every frame, the way every game nameplate works: without it, a plane is invisible edge-on and gone entirely from behind, because single-sided geometry culls its back face. transparent honours the rounded corners, toneMapped keeps the text out of the ACES curve, and label.width and height arrive already in scene units. Your HTML is now a surface in the world: occluded, screenshotted and streamed like everything else.",
        renderPath: true,
        check: "labelMesh",
      },
      {
        num: "5.5",
        title: "Ship it",
        body:
          "The last step does two things, because the first one makes this panel disappear. Comment out the MirisGuide line in app/main.tsx: the guide goes, your app stays exactly as you built it, and the Miris styling stays too, since index.html loads it. Then press Deploy in Bolt, wait for your link, and send it to someone. What they load is not a model file, it is your asset streaming to them at whatever detail their screen and connection justify.",
        code: "{/* <MirisGuide /> */}",
      },
    ],
  },
];
