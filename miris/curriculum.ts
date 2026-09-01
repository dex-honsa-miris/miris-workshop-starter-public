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
  /** Renders the fal panel opener. */
  panel?: boolean;
  /** Renders the uuid and viewer key fields. */
  fields?: boolean;
}

export interface Step {
  num: string;
  title: string;
  time: string;
  subs: Sub[];
}

export const STEPS: Step[] = [
  {
    num: "01",
    title: "Set up",
    time: "20 min",
    subs: [
      {
        num: "1.1",
        title: "Your fal key",
        body:
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Then stop and restart the dev server: environment files are only read at boot.",
        code: "FAL_KEY=your-key-here",
      },
      {
        num: "1.2",
        title: "Describe your thing",
        body:
          "Open the panel and write a prompt. One subject, centered, on a plain backdrop. Splats carry what normal materials fight with: fur, membranes, gilt, patina, worn stone. Ask for those. You will get an image in a few seconds, and you can reroll as many times as you like before committing to the slow step.",
        panel: true,
      },
      {
        num: "1.3",
        title: "Make your Miris account",
        body:
          "Do this while the 3D model generates, because that takes four to six minutes. Sign up at app.miris.com, then upload the .glb the panel gives you. Processing takes a few more minutes. You need two things from the console afterwards: the asset uuid and a viewer key.",
      },
    ],
  },
  {
    num: "02",
    title: "Build the stage",
    time: "35 min",
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
          "An HDR image lights the scene from every direction at once, which is what makes a surface look like it is in a real room rather than under a lamp. Note the intensity is 1.6, not the 0.6 a normal scene wants. This canvas renders in linear colour space because that is what the splat compositor needs, and that darkens everything else, so the environment is pushed up to compensate.",
      },
      {
        num: "2.3",
        title: "Hand the frame to Miris",
        body:
          "This is the one genuinely surprising thing in the whole workshop. Press the button, then read the explanation carefully, because it is the difference between a working stage and a blank one.",
        fill: "frame",
        explain:
          "React Three Fiber normally draws every frame for you. Here it must not. The Miris engine draws the frame instead, and its doRendering call draws both the ordinary three.js content and the streamed splats. If R3F also rendered, everything would be drawn twice. Passing a priority of 1 to useFrame switches R3F's automatic render off and hands the job over. That is also why the scene given to Canvas is a MirisScene rather than a plain three.js one: the stream registers itself with the scene, and a plain scene has nowhere to register.",
      },
      {
        num: "2.4",
        title: "Your first stream",
        body:
          "This uses our demo asset so you can see it working before yours is ready. Yours goes in at step 4.",
        fill: "stream",
        explain:
          "A stream is not a file you load, it is a subscription. Detail arrives progressively, which means the size of the thing is not known when it first appears and grows as more of it arrives. That is why the code waits for the reported size to stop changing before it places the asset: fitting on the first reading puts it in the wrong place at the wrong scale. It gives up waiting after twenty tries, because a slightly wrong fit beats an empty pedestal.",
      },
    ],
  },
  {
    num: "03",
    title: "Make it yours",
    time: "20 min",
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
        title: "Sit it properly on the plinth",
        body:
          "Read this now and apply it at step 4.3, once your own asset is streaming: it will probably float, and that is worth understanding rather than working around. The SDK reports a bounding box that is the octree cell holding your asset, not the asset itself, so its floor is not where your model starts. Open miris/config.ts and add an entry to FIT_OVERRIDES keyed by your uuid, then adjust floor until it sits on the rim. Negative floor values push it up. Leave scale alone unless it also looks wrong: the automatic fit already sizes the asset to the plinth.",
        code: 'FIT_OVERRIDES["your-uuid"] = { scale: 0.44, floor: -1.017 };',
      },
      {
        num: "3.3",
        title: "Light it your way",
        body:
          "Change environmentIntensity in the Environment line. Below 1.0 gets moody and the rim starts to dominate. Above 2.5 blows out the highlights. You can also drop in your own .hdr: put it in public/env/ and change the filename. Polyhaven has thousands, free.",
      },
    ],
  },
  {
    num: "04",
    title: "Go live",
    time: "20 min",
    subs: [
      {
        num: "4.1",
        title: "Upload your model",
        body:
          "You started this at step 1.3. Back in the Miris console, check your upload has finished processing, then copy two values: the asset uuid from the asset page, and a viewer key from your account settings. The viewer key is what lets a browser read your asset without logging anyone in.",
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
    ],
  },
  {
    num: "05",
    title: "Ship it",
    time: "15 min",
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
