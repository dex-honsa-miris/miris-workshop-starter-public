import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { readMarker, replaceMarker } from "./markers.mjs";
import { readData, writeData } from "./store.mjs";
import { MARKER_FOR, SNIPPETS } from "./snippets.mjs";
import { IMAGE_MODEL, MODEL_3D } from "./config";
import { TRACKS } from "./tracks";

/* Dev only, by construction: configureServer has no production counterpart, so
 * a built app has no endpoint to reach. */

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
const TEMPLATE = join(MIRIS_DIR, "stage.template.tsx");
const MAIN = join(ROOT, "app", "main.tsx");

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
    return imageUrl ? null : "No image yet. Open the panel and generate one.";
  },

  async pedestal() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("cylinderGeometry")
      ? null
      : "The scene block in app/stage.tsx is still empty. Paste the snippet between the miris:scene comments, or let the step do it.";
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

  async uuid() {
    const { uuid } = await readData(MIRIS_DIR);
    if (!uuid) return "No asset uuid saved yet. Paste it into the field above and click away from the box.";
    // A uuid pasted with surrounding text streams nothing and reports nothing.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
      ? null
      : `That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`;
  },

  async card() {
    const { card } = await readData(MIRIS_DIR);
    if (!card || typeof card !== "object" || !(card as any).name) {
      return "miris/data.json still has no card. Paste miris/skills/curator.md into your agent, then press the button.";
    }
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    return block.includes("Card")
      ? null
      : "The card is written but not on the stage yet. Add the line to the miris:card block, or let the step do it.";
  },

  async cardSurface() {
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    return block.includes("CardSurface")
      ? null
      : "The label is not drawn into the scene yet. Swap the line in the miris:card block, or let the step do it.";
  },

  async guideOff() {
    const source = await readFile(MAIN, "utf8");
    const live = source
      .split("\n")
      .some((l) => l.includes("<MirisGuide") && !l.trimStart().startsWith("//") && !l.includes("{/*"));
    return live ? "app/main.tsx still renders <MirisGuide />. Comment that line out and save." : null;
  },
};

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (error: string, status = 400): Reply => ({ status, body: { error } });

async function handle(action: string, body: any, mode: string): Promise<Reply> {
  const falHeaders = () => ({
    Authorization: `Key ${falKey(mode)}`,
    "Content-Type": "application/json",
  });

  async function falRun(model: string, input: unknown, recordIn?: string) {
    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
    });
    if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${await submit.text()}`);
    const job = await submit.json();

    // Recorded before the wait, so a dev server killed mid-generation costs
    // nothing: the job is still findable on fal.
    if (recordIn) await writeData(recordIn, { falRequestId: job.request_id ?? "" });

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

    case "reset": {
      const marker = String(body.marker ?? "");
      const template = await readFile(TEMPLATE, "utf8");
      const open = `{/* miris:${marker}-start */}`;
      const close = `{/* miris:${marker}-end */}`;
      const a = template.indexOf(open);
      const b = template.indexOf(close);
      if (a === -1 || b === -1) return fail(`unknown marker: ${marker}`);
      const blank = template.slice(a + open.length, b).trim();
      const source = await readFile(STAGE, "utf8");
      await writeFile(STAGE, replaceMarker(source, marker, blank));
      return ok({ ok: true, marker });
    }

    case "save":
      return ok(await writeData(MIRIS_DIR, body.patch ?? {}));

    case "check": {
      const check = CHECKS[String(body.check ?? "")];
      // No check for this step is not a failure: it means nothing on disk
      // proves it, so the attendee's word is what we have.
      if (!check) return ok({ done: true });
      const problem = await check(mode);
      return ok({ done: !problem, problem });
    }

    case "image": {
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      /* Strict, unlike trackById: that falls back to TRACKS[0], which is summon,
       * so an unset track quietly rendered every attendee a creature in the
       * monster-taming style whichever door they had picked. */
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const out: any = await falRun(IMAGE_MODEL, {
        prompt: `${track.style}: ${body.prompt}`,
        image_size: "square_hd",
        num_images: 1,
        quality: "medium",
      });
      const url = out?.images?.[0]?.url;
      if (!url) return fail("fal returned no image", 502);
      await writeData(MIRIS_DIR, { prompt: body.prompt, imageUrl: url });
      return ok({ url });
    }

    case "model": {
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const out: any = await falRun(
        MODEL_3D,
        {
          image_url: body.imageUrl,
          // Styled the same way the image was. The mesh takes its look from the
          // image, but the texture pass reads this, and it was the one call in
          // the workflow the track never reached.
          texture_prompt: `${track.style}: ${body.prompt ?? ""}`,
          ...MESHY_INPUT,
        },
        MIRIS_DIR,
      );
      const url = out?.model_glb?.url;
      if (!url) return fail("fal returned no mesh", 502);
      await writeData(MIRIS_DIR, { glb: url });
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
    configureServer(server) {
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
