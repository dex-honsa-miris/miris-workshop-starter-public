import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { end as markerEnd, readMarker, replaceMarker, start as markerStart } from "./markers.mjs";
import { PIECE_IDS, readData, writeData, writePiece } from "./store.mjs";
import { CLEARS_TO, MARKER_FOR, SNIPPETS, PARTS } from "./snippets.mjs";
import { DEMO_UUID, IMAGE_FRAMING, IMAGE_MODEL, LABEL_LLM, LABEL_MODEL, MODEL_3D, VIEWER_KEY } from "./config";
import { TRACKS } from "./tracks";
import { checkIntegrity } from "./integrity.mjs";
import { FLAT_SUBS } from "./progress";

/* Dev only, by construction: configureServer has no production counterpart, so
 * a built app has no endpoint to reach. */

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
const TEMPLATE = join(MIRIS_DIR, "stage.template.tsx");

const MESHY_INPUT = {
  should_texture: true,
  enable_pbr: true,
  model_type: "standard",
  ultra_mode: true,
  topology: "triangle",
  target_polycount: 300000,
  symmetry_mode: "auto",
  enable_safety_checker: true,
};

/* One check per step that has something verifiable on disk. Each returns null
 * when the step is done, or the sentence the attendee needs to read. Steps that
 * happen elsewhere entirely, signing up or deploying, have no entry: the Done
 * button just moves them on rather than pretending to know. */
const CHECKS: Record<string, (mode: string) => Promise<string | null>> = {
  async falKey(mode) {
    return falKey(mode)
      ? null
      : "No FAL_KEY yet. Create .env.local at the top level of the project, put your key in it, and save.";
  },

  async image() {
    const { imageUrl } = await readData(MIRIS_DIR);
    return imageUrl ? null : "No image yet. Write a prompt at step 1.2 and generate one.";
  },

  async pedestal() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("cylinderGeometry")
      ? null
      : "The scene block in app/stage.tsx has no pedestal in it yet. Paste the snippet between the miris:scene comments, or let the step do it.";
  },

  async environment() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("Environment")
      ? null
      : "No Environment line in the scene block yet. Add it under the pedestal, or let the step do it.";
  },

  async stream() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("mirisStream")
      ? null
      : "No mirisStream in the scene block yet. Add it under the Environment line, or let the step do it.";
  },

  async streamUuid() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    const uuid = block.match(/uuid:\s*"([^"]*)"/)?.[1];
    if (!uuid) return "No uuid string in the mirisStream args yet. It went in at step 2.4.";
    // A uuid pasted with surrounding text streams nothing and reports nothing.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))
      return `That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`;
    if (uuid === DEMO_UUID)
      return "The stream still points at the demo asset. Replace the uuid string in app/stage.tsx with your asset id.";
    const key = block.match(/viewerKey:\s*"([^"]*)"/)?.[1];
    if (!key)
      return "The viewerKey string is empty. Paste your key from the portal: the demo key cannot read your asset.";
    return null;
  },

  async card() {
    const { card } = await readData(MIRIS_DIR);
    return card && typeof card === "object" && (card as any).name
      ? null
      : "miris/data.json still has no card. Press Write the label.";
  },

  async cardOverlay() {
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    return block.includes("<Card")
      ? null
      : "The card is not over the canvas yet. Add the line to the miris:card block, or let the step do it.";
  },

  async labelHtml() {
    const block = readMarker(await readFile(STAGE, "utf8"), "label");
    return block.includes("useHtmlTexture")
      ? null
      : "No useHtmlTexture call in the miris:label block yet. It goes above the return, or let the step do it.";
  },

  async labelMesh() {
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    if (!block.includes("planeGeometry"))
      return "No plane in the miris:card block yet. Swap the overlay for the mesh, or let the step do it.";
    return block.includes("label.texture")
      ? null
      : "The plane is there but nothing maps the label texture onto it.";
  },

};

/* The register that used to live in miris/skills/curator.md, when writing the
 * label meant pasting that file into a coding agent. Same rules, smaller
 * ceremony: one button, one model call on the attendee's own fal key. */
const CURATOR =
  "You write the label for a single object in a collection. " +
  "Reply with ONLY a JSON object, no code fences, no commentary: " +
  '{"name": "two or three words", "description": "one sentence, under twenty words", "attributes": ["three or four short phrases"]}. ' +
  "Match the object rather than a house style: a creature gets an epithet, an ability and a line of lore; " +
  "a product gets materials, a price and an edition; an artifact gets a date, a place and a provenance. " +
  "Write as though the object has always existed. Never mention that it was generated, never use the word digital, " +
  'do not hedge with "appears to be", and use no em dashes.';

const parseCard = (raw: unknown) => {
  if (typeof raw !== "string") return null;
  // Models fence JSON out of habit however firmly they are told not to.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const c = JSON.parse(text);
    if (typeof c?.name !== "string" || typeof c?.description !== "string" || !Array.isArray(c?.attributes)) return null;
    return { name: c.name, description: c.description, attributes: c.attributes.map(String).slice(0, 4) };
  } catch {
    return null;
  }
};

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (error: string, status = 400): Reply => ({ status, body: { error } });

async function handle(action: string, body: any, mode: string): Promise<Reply> {
  const falHeaders = () => ({
    Authorization: `Key ${falKey(mode)}`,
    "Content-Type": "application/json",
  });

  async function falRun(
    model: string,
    input: unknown,
    record?: (patch: object) => Promise<unknown>,
  ) {
    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
    });
    if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${await submit.text()}`);
    const job = await submit.json();

    // Recorded before the wait, so a dev server killed mid-generation costs
    // nothing: the job is still findable on fal. A callback rather than a
    // directory, because three pieces build at once and each must record
    // against its own slot.
    if (record) await record({ falRequestId: job.request_id ?? "", modelStartedAt: Date.now() });

    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(job.status_url, { headers: falHeaders() });
      if (!poll.ok) throw new Error(`fal status ${poll.status}: ${(await poll.text()).slice(0, 200)}`);
      const status = await poll.json();
      if (status.status === "FAILED" || status.status === "ERROR") throw new Error("fal reported failure");
      if (status.status === "COMPLETED") {
        const done = await fetch(job.response_url, { headers: falHeaders() });
        if (!done.ok) throw new Error(`fal result ${done.status}: ${(await done.text()).slice(0, 200)}`);
        return done.json();
      }
    }
    throw new Error("fal timed out after 25 minutes");
  }

  switch (action) {
    case "fill": {
      const snippet = SNIPPETS[body.snippetId as keyof typeof SNIPPETS];
      const marker = MARKER_FOR[body.snippetId as keyof typeof MARKER_FOR];
      if (!snippet) return fail(`unknown snippet: ${body.snippetId}`);
      const source = await readFile(STAGE, "utf8");
      await writeFile(STAGE, replaceMarker(source, marker, snippet));
      return ok({ ok: true, marker });
    }

    case "clear": {
      const id = String(body.snippetId ?? "");
      const marker = MARKER_FOR[id as keyof typeof MARKER_FOR];
      if (!marker) return fail(`unknown snippet: ${id}`);

      // One step back, not the whole marker.
      const back = CLEARS_TO[id as keyof typeof CLEARS_TO];
      let body_: string;
      if (back) {
        body_ = SNIPPETS[back as keyof typeof SNIPPETS];
      } else {
        const template = await readFile(TEMPLATE, "utf8");
        // From markers.mjs, never rebuilt here: the label marker is a //-style
        // comment, and a hardcoded JSX form made clearing it fail as unknown.
        const open = markerStart(marker);
        const close = markerEnd(marker);
        const a = template.indexOf(open);
        const b = template.indexOf(close);
        if (a === -1 || b === -1) return fail(`unknown marker: ${marker}`);
        // Leading newlines and all trailing space, but not the leading indent:
        // the template's block carries the six columns that line its comment up
        // with the JSX, and trim() restored it at column 0. With this, a Clear
        // puts stage.tsx back byte-identical to the template.
        body_ = template.slice(a + open.length, b).replace(/^\n+/, "").replace(/\s+$/, "");
      }

      const source = await readFile(STAGE, "utf8");
      await writeFile(STAGE, replaceMarker(source, marker, body_));
      return ok({ ok: true, marker, back: back ?? null });
    }

    case "save":
      return ok(await writeData(MIRIS_DIR, body.patch ?? {}));

    case "piece": {
      const id = String(body.id ?? "");
      if (!PIECE_IDS.includes(id)) return fail(`unknown piece: ${id || "(none)"}`);
      return ok(await writePiece(MIRIS_DIR, id, body.patch ?? {}));
    }

    case "check": {
      const check = CHECKS[String(body.check ?? "")];
      // No check for this step is not a failure: it means nothing on disk
      // proves it, so the attendee's word is what we have.
      if (!check) return ok({ done: true });
      const problem = await check(mode);
      return ok({ done: !problem, problem });
    }

    case "label": {
      const pieceId = String(body.id ?? "01");
      if (!PIECE_IDS.includes(pieceId)) return fail(`unknown piece: ${pieceId || "(none)"}`);
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const piece = stored.pieces.find((p) => p.id === pieceId);
      if (!piece?.prompt) return fail("No prompt to write from. Step 1.2 is where it comes from.");
      const out: any = await falRun(LABEL_MODEL, {
        model: LABEL_LLM,
        system_prompt: CURATOR,
        prompt: `The object: ${piece.prompt}. Its kind: ${track.noun}.`,
        temperature: 0.9,
      });
      const card = parseCard(out?.output);
      if (!card) return fail("The model wrote something that is not a card. Press the button again.", 502);
      await writePiece(MIRIS_DIR, pieceId, { card });
      return ok({ card });
    }

    case "image": {
      const pieceId = String(body.id ?? "01");
      if (!PIECE_IDS.includes(pieceId)) return fail(`unknown piece: ${pieceId || "(none)"}`);
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      /* Strict, unlike trackById: that falls back to TRACKS[0], which is summon,
       * so an unset track quietly rendered every attendee a creature in the
       * monster-taming style whichever door they had picked. */
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const out: any = await falRun(IMAGE_MODEL, {
        prompt: `${track.style}: ${body.prompt}. ${IMAGE_FRAMING}`,
        image_size: "square_hd",
        num_images: 1,
        quality: "medium",
      });
      const url = out?.images?.[0]?.url;
      if (!url) return fail("fal returned no image", 502);
      await writePiece(MIRIS_DIR, pieceId, { prompt: body.prompt, imageUrl: url });
      return ok({ url });
    }

    case "model": {
      const pieceId = String(body.id ?? "01");
      // Checked before falKey and before any fal call. fal bills at submit, so
      // validating once the mesh request is already out would be too late to
      // save the cost.
      if (!PIECE_IDS.includes(pieceId)) return fail(`unknown piece: ${pieceId || "(none)"}`);
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      let out: any;
      try {
        out = await falRun(
          MODEL_3D,
          {
            image_url: body.imageUrl,
            // Styled the same way the image was. The mesh takes its look from
            // the image, but the texture pass reads this, and it was the one
            // call in the workflow the track never reached.
            texture_prompt: `${track.style}: ${body.prompt ?? ""}`,
            ...MESHY_INPUT,
          },
          (patch) => writePiece(MIRIS_DIR, pieceId, patch),
        );
      } catch (e) {
        // The browser that asked may be gone: a Fill reloads the page, and the
        // client resumes "building" off modelStartedAt. Clearing it is how a
        // resumed client learns the job died rather than waiting forever.
        await writePiece(MIRIS_DIR, pieceId, { modelStartedAt: 0 });
        throw e;
      }
      const url = out?.model_glb?.url;
      if (!url) {
        await writePiece(MIRIS_DIR, pieceId, { modelStartedAt: 0 });
        return fail("fal returned no mesh", 502);
      }
      await writePiece(MIRIS_DIR, pieceId, { glb: url });
      return ok({ url });
    }

    default:
      return fail(`unknown action: ${action}`);
  }
}

const send = (res: ServerResponse, { status, body }: Reply) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

/* Read per request rather than capturing at config time. loadEnv is a plain
 * file read, so an attendee who pastes their key into .env.local does not also
 * have to restart the dev server for it to count. */
const falKey = (mode: string) => loadEnv(mode, ROOT, "").FAL_KEY ?? "";

export function mirisDevApi(mode: string): Plugin {
  return {
    name: "miris-dev-api",
    // Dev only, by construction. There is no production counterpart.
    apply: "serve",

    /* Every change to app/stage.tsx reloads the page. Unconditionally, after
     * two rounds of being cleverer than this: a Fast Refresh of a mounted
     * <mirisStream> leaves the SDK's own scene objects behind (measured two
     * SparkRenderers in one scene, splats drawn twice, the model smearing as
     * the camera moves), and scoping the reload to "only when a stream was
     * mounted" still ghosted in Bolt on the stream's FIRST mount, through an
     * HMR path localhost never reproduced. A fresh boot is the only state
     * this SDK provably cannot double. The reload is cheap because everything
     * durable lives in data.json: the tray, its fold state, and an in-flight
     * mesh build all resume. */
    handleHotUpdate({ file, server }) {
      if (file === STAGE) {
        server.hot.send({ type: "full-reload" });
        return [];
      }
    },

    configureServer(server) {
      // Fire and forget. The middleware must not wait on two file reads, and a
      // content problem is loud but never fatal.
      void (async () => {
        const problems = checkIntegrity({
          subs: FLAT_SUBS,
          snippets: SNIPPETS,
          parts: PARTS,
          clearsTo: CLEARS_TO,
          markerFor: MARKER_FOR,
          checks: CHECKS,
          files: {
            "app/stage.tsx": await readFile(STAGE, "utf8"),
            "miris/stage.template.tsx": await readFile(TEMPLATE, "utf8"),
          },
        });
        if (!problems.length) return;
        // A content author mid-edit should see the list rather than lose the
        // dev server, and every one of these is a workshop that would
        // otherwise fail in front of a room.
        console.error(`\n  Workshop content problems (${problems.length}):`);
        for (const p of problems) console.error(`   - ${p}`);
        console.error("");
      })();

      server.middlewares.use("/api/miris", async (req, res, next) => {
        try {
          if (req.method === "GET") return send(res, ok(await readData(MIRIS_DIR)));

          if (req.method === "POST") {
            let body: any;
            try {
              body = JSON.parse(await readBody(req));
            } catch {
              return send(res, fail("body must be JSON"));
            }
            return send(res, await handle(String(body.action ?? ""), body, mode));
          }

          next();
        } catch (e) {
          send(res, fail((e as Error).message, 500));
        }
      });
    },
  };
}
