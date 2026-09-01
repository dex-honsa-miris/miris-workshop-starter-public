import { FAL_KEYS_URL, PORTAL_URL } from "./config";

export interface Sub {
  num: string;
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
  /** Renders the uuid and viewer key fields. */
  fields?: boolean;
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
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Then stop and restart the dev server: environment files are only read at boot.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
      },
      {
        num: "1.2",
        title: "Describe your thing",
        body:
          "Open the panel and write a prompt. One subject, centered, on a plain backdrop. Splats carry what normal materials fight with: fur, membranes, gilt, patina, worn stone. Ask for those. GPT Image 2 takes about a minute, so reroll deliberately rather than often: this is the last cheap step before the four minute one.",
        panel: true,
      },
      {
        num: "1.3",
        title: "Make your Miris account",
        body:
          "Do this while the 3D model generates, because that takes four to six minutes. Sign up at app.miris.com, then upload the .glb the panel gives you. Processing takes a few more minutes. You need two things from the portal afterwards: the asset uuid and a viewer key.",
        link: { href: PORTAL_URL, label: "Open Miris" },
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
          "Everything needs a floor and something to stand on it. Press the button, then open app/stage.tsx and find the block between the two miris:scene comments. That is where your code lands, and everything you write outside those comments is left alone.",
        fill: "pedestal",
        explain:
          "Two meshes. A cylinder for the plinth, tapered slightly wider at the base, and a thin torus for the bright rim. The rim uses meshBasicMaterial, which ignores lighting entirely, so it reads as a crisp edge no matter what the environment does. Nothing here is a Miris idea yet: this is plain three.js through React Three Fiber.",
      },
      {
        num: "2.2",
        title: "Sky and light",
        body:
          "One line, and the whole scene changes. Press the button and look at the pedestal before and after.",
        fill: "environment",
        explain:
          "An HDR image lights the scene from every direction at once, which is what makes a surface look like it is in a real room rather than under a lamp. Note the intensity is 1.6, not the 0.6 a normal scene wants. This canvas renders in linear colour space, which darkens everything else, so the environment is pushed up to compensate.",
      },
      {
        num: "2.3",
        title: "Your first stream",
        body:
          "This uses our demo asset so you can see it working before yours is ready. Yours goes in at step 4.",
        fill: "stream",
        explain:
          "A stream is not a file you load, it is a subscription. What appears first is a coarse version of the whole asset, and it sharpens as more arrives, so there is never a moment where you wait on a download. The extend call at the top of app/stage.tsx is what buys you that: it registers MirisStream as a JSX tag, so the stream takes position and scale like any other three.js object and React Three Fiber draws it in the same pass as the pedestal. There is no viewer to embed and no render loop to hand over. The numbers are measured for the demo asset. Yours will need its own, at step 4.4.",
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
          "No button for this one. Open app/stage.tsx and find the camera prop on Canvas. position is [x, y, z] in world units, and the pedestal top is at y 0.5, so [0, 1.5, 3.4] is roughly eye level and a little back. Try [0, 0.8, 2.2] for a low hero angle, or raise fov from 40 to 60 and watch the perspective stretch. Save and the page updates as you type.",
        code: "camera={{ position: [0, 1.5, 3.4], fov: 40 }}",
      },
      {
        num: "3.2",
        title: "Light it your way",
        body:
          "Change environmentIntensity in the Environment line. Below 1.0 gets moody and the rim starts to dominate. Above 2.5 blows out the highlights. You can also drop in your own .hdr: put it in public/env/ and change the filename. Polyhaven has thousands, free.",
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
          "You started this at step 1.3. Back in the Miris portal, check your upload has finished processing, then copy two values: the asset uuid from the asset page, and a viewer key from your account settings. The viewer key is what lets a browser read your asset without logging anyone in.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "4.2",
        title: "Paste them in",
        body:
          "Both are saved to miris/data.json, which is the one file that survives a refresh. Nothing else about your scene changes.",
        fields: true,
      },
      {
        num: "4.3",
        title: "Watch the swap",
        body:
          "Your own asset is now streaming onto the same pedestal, under the same lighting, through the same camera.",
        explain:
          "Nothing about your scene changed except where the geometry comes from. The pedestal, the environment, the camera and the render loop are identical. That is the whole point of this workshop: streaming is a delivery change, not a rendering change. You did not load a file that happened to be big. You subscribed to something that arrives at whatever detail the view justifies.",
      },
      {
        num: "4.4",
        title: "Sit it on the plinth",
        body:
          "Yours will not land where the demo asset did. Open app/stage.tsx and edit the position and scale on mirisStream until it sits on the rim. Change scale first, then the middle number of position to drop it onto the surface, then the outer two to centre it. The pedestal top is at y 0.5. Save and the page updates as you type.",
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
        title: "Let an agent write the label",
        body:
          "Open miris/skills/curator.md, copy the whole thing, and paste it into your coding agent's chat, which in Bolt is the panel on the left. It reads your prompt out of miris/data.json and writes a name, a description and a few attributes back into the same file. Then press the button below to put that card on the stage.",
        fill: "card",
        explain:
          "The agent only touches one field of one JSON file, deliberately. You have something working and about to be published, and this is the wrong moment for an agent to be editing your scene code. It is also the right kind of job for a model: writing copy in a register, rather than a mechanical edit you could do faster yourself.",
      },
      {
        num: "5.2",
        title: "Remove the guide",
        body:
          "Open app/main.tsx and comment out the MirisGuide line. The panel disappears and your app stays exactly as you built it. The Miris styling stays too, because index.html loads it, not the guide.",
        code: "{/* <MirisGuide /> */}",
      },
      {
        num: "5.3",
        title: "Publish and share",
        body:
          "Deploy it and wait for your link, with Deploy in Bolt or your own host. Send it to someone. What they load is not a model file, it is your asset streaming to them at whatever detail their screen and connection justify.",
      },
    ],
  },
];
