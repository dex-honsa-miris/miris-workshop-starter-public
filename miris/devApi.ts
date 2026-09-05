import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { end as markerEnd, readMarker, replaceMarker, start as markerStart } from "./markers.mjs";
import { PIECE_IDS, readData, writeData, writePiece } from "./store.mjs";
import { CLEARS_TO, MARKER_FOR, SNIPPETS, PARTS } from "./snippets.mjs";
import { BOUTIQUE, IMAGE_FRAMING, IMAGE_MODEL, LABEL_LLM, LABEL_MODEL, MODEL_3D, VIEWER_KEY } from "./config";
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

/** The attendee's own code for one marker, read out of their stage file. Never
 *  the whole file: an import at the top, or a neighbouring block, would
 *  otherwise pass a step nobody has done. */
const stageBlock = async (marker: string) => readMarker(await readFile(STAGE, "utf8"), marker);

/** Canonical 8-4-4-4-12. The one thing here matched by shape rather than
 *  looked for: a uuid carrying a stray character or a word of surrounding text
 *  streams nothing and reports nothing, so a substring would pass a stream that
 *  can never arrive. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* One check per step that has something verifiable on disk. Each returns null
 * when the step is done, or the sentence the attendee needs to read. Steps that
 * happen elsewhere entirely, signing up or deploying, have no entry: the Done
 * button just moves them on rather than pretending to know.
 *
 * Lenient on purpose, and substring-shaped: a check confirms the step happened,
 * it never grades how. Every sentence names the file, the block and the missing
 * thing, because the only person who reads one is stuck. */
const CHECKS: Record<string, (mode: string) => Promise<string | null>> = {
  async falKey(mode) {
    return falKey(mode)
      ? null
      : "No FAL_KEY yet. Create .env.local at the top level of the project, put FAL_KEY=your-key in it, and save.";
  },

  async room() {
    const block = await stageBlock("room");
    return block.includes(".glb")
      ? null
      : "Nothing loads a glb in the miris:room block in app/stage.tsx yet. The shell is public/env/room.glb, so fill the step or paste the snippet between the miris:room comments.";
  },

  async lights() {
    const block = await stageBlock("lights");
    // A tag, not the word: the block ships with a comment in it, and prose
    // about lighting must not read as a light.
    return /<\w*[Ll]ight/.test(block)
      ? null
      : "No light in the miris:lights block in app/stage.tsx yet. The room stays black until something lights it, so fill the step or paste the snippet between the miris:lights comments.";
  },

  async quality() {
    const block = await stageBlock("quality");
    return /[Tt]oneMapping|environmentIntensity|RoomEnvironment|<Environment/.test(block)
      ? null
      : "Nothing in the miris:quality block in app/stage.tsx sets tone mapping or an environment yet. Brass has nothing to reflect until it does, so fill the step or paste the snippet between the miris:quality comments.";
  },

  async materials() {
    const block = await stageBlock("materials");
    return /Material/.test(block)
      ? null
      : "No material in the miris:materials block in app/stage.tsx yet. The room keeps whatever surfaces the glb shipped with until the block replaces them, so fill the step or paste the snippet between the miris:materials comments.";
  },

  async props() {
    const block = await stageBlock("props");
    return block.includes(".glb")
      ? null
      : "No prop in the miris:props block in app/stage.tsx yet. The props are the glb files in public/props, so fill the step or paste the snippet between the miris:props comments.";
  },

  async stops() {
    const block = await stageBlock("stops");
    // A numeric triple, not a field name: the empty array the template ships
    // carries "pos" and "look" already, in its type annotation.
    return /\[\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\]/.test(block)
      ? null
      : "STOPS is still the empty array in the miris:stops block in app/stage.tsx. Author at least one stop, with a pos and a look, above the return.";
  },

  async rail() {
    const block = await stageBlock("rail");
    return /STOPS|useFrame/.test(block)
      ? null
      : "Nothing in the miris:rail block in app/stage.tsx reads STOPS yet. The flight between your stops goes between the miris:rail comments, so fill the step or paste the snippet in.";
  },

  async image() {
    const { pieces } = await readData(MIRIS_DIR);
    return pieces.some((p) => p.imageUrl)
      ? null
      : "No piece in miris/data.json has an image yet. Write a prompt for at least one of the three slots and generate it.";
  },

  async catalog() {
    const block = await stageBlock("catalog");
    if (!block.includes("mirisStream"))
      return "No mirisStream in the miris:catalog block in app/stage.tsx yet. The shelves stay empty until the catalog streams onto them, so fill the step or paste the snippet between the miris:catalog comments.";
    // Only when a uuid was written out by hand. A block that maps over
    // miris/catalog.json has none to read, which is the point of the map.
    const literal = block.match(/uuid:\s*["'`]([^"'`]*)["'`]/);
    if (literal && !UUID.test(literal[1]))
      return `That uuid does not look like one: "${literal[1]}". Copy just the id, four dashes and nothing around it, from the asset in miris/catalog.json.`;
    return null;
  },

  async catalogFit() {
    const block = await stageBlock("catalog");
    return block.includes("scale={inlet.scale}")
      ? null
      : "No scale on the streams in the miris:catalog block in app/stage.tsx yet. Each piece carries its display scale in miris/catalog.json; without it they mount at capture scale and read as thumbnails on the shelf. Fill the step or paste the snippet in.";
  },

  async card() {
    const { pieces } = await readData(MIRIS_DIR);
    return pieces.some((p) => (p.card as any)?.name)
      ? null
      : "No placard in miris/data.json yet. Press Write the label on a piece you have already described.";
  },

  async cardOverlay() {
    const block = await stageBlock("card");
    return block.includes("<Html")
      ? null
      : "No <Html> in the miris:card block in app/stage.tsx yet. The placard floats over the canvas from between the miris:card comments, so fill the step or paste the snippet in.";
  },

  async labelHtml() {
    const block = await stageBlock("label");
    if (!block.includes("useHtmlTexture"))
      return "No useHtmlTexture call in the miris:label block in app/stage.tsx yet. It goes above the return, because it is a hook.";
    // The template calls it with false, which paints nothing. Done is when it
    // has been handed markup.
    return /useHtmlTexture\(\s*false\s*\)/.test(block)
      ? "useHtmlTexture is still called with false in the miris:label block in app/stage.tsx. Pass it your placard markup so it has something to paint."
      : null;
  },

  async labelMesh() {
    const block = await stageBlock("card");
    if (!block.includes("planeGeometry"))
      return "No planeGeometry in the miris:card block in app/stage.tsx yet. The painted label needs a plane to sit on, so fill the step or paste the snippet in.";
    return /texture/.test(block)
      ? null
      : "The plane is in the miris:card block in app/stage.tsx but nothing maps the label texture onto it.";
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
      const piece = stored.pieces.find((p) => p.id === pieceId);
      if (!piece?.prompt) return fail("No prompt to write from. Step 1.2 is where it comes from.");
      const out: any = await falRun(LABEL_MODEL, {
        model: LABEL_LLM,
        system_prompt: CURATOR,
        prompt: `The object: ${piece.prompt}. Its kind: ${BOUTIQUE.noun}.`,
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
      const out: any = await falRun(IMAGE_MODEL, {
        prompt: `${BOUTIQUE.style}: ${body.prompt}. ${IMAGE_FRAMING}`,
        image_size: "square_hd",
        num_images: 1,
        quality: "medium",
      });
      const url = out?.images?.[0]?.url;
      if (!url) return fail("fal returned no image", 502);
      await writePiece(MIRIS_DIR, pieceId, { prompt: body.prompt, imageUrl: url, status: "image-ready" });
      return ok({ url });
    }

    case "model": {
      const pieceId = String(body.id ?? "01");
      // Checked before falKey and before any fal call. fal bills at submit, so
      // validating once the mesh request is already out would be too late to
      // save the cost.
      if (!PIECE_IDS.includes(pieceId)) return fail(`unknown piece: ${pieceId || "(none)"}`);
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      let out: any;
      try {
        out = await falRun(
          MODEL_3D,
          {
            image_url: body.imageUrl,
            // Styled the same way the image was. The mesh takes its look from
            // the image, but the texture pass reads this too, and it was the
            // one call in the workflow the style prefix never reached.
            texture_prompt: `${BOUTIQUE.style}: ${body.prompt ?? ""}`,
            ...MESHY_INPUT,
          },
          (patch) => writePiece(MIRIS_DIR, pieceId, { ...patch, status: "generating-mesh" }),
        );
      } catch (e) {
        // The browser that asked may be gone: a Fill reloads the page, and the
        // client resumes "building" off modelStartedAt. Clearing it is how a
        // resumed client learns the job died rather than waiting forever.
        await writePiece(MIRIS_DIR, pieceId, { modelStartedAt: 0, status: "failed" });
        throw e;
      }
      const url = out?.model_glb?.url;
      if (!url) {
        await writePiece(MIRIS_DIR, pieceId, { modelStartedAt: 0, status: "failed" });
        return fail("fal returned no mesh", 502);
      }
      await writePiece(MIRIS_DIR, pieceId, { glb: url, status: "mesh-ready" });
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
        try {
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
        } catch (e) {
          // An unhandled rejection in this floating IIFE would kill the dev
          // server, which is the one thing this check must never do.
          console.error(`Workshop content check could not read files: ${(e as Error).message}`);
        }
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
