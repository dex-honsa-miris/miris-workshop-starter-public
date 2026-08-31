import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { replaceMarker } from "./markers.mjs";
import { readData, writeData } from "./store.mjs";
import { MARKER_FOR, SNIPPETS } from "./snippets.mjs";
import { IMAGE_MODEL, MODEL_3D } from "./config";
import { trackById } from "./tracks";

/* The workshop API. Writes files and spends a fal key, which are
 * development-only powers.
 *
 * Under Next this was a route handler that had to check NODE_ENV at runtime,
 * because commenting out the guide did not remove the route and attendees
 * publish this app at step 5.3. As Vite dev middleware the guarantee is
 * structural instead: configureServer never runs in a production build, so
 * there is no endpoint to reach. */

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

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (error: string, status = 400): Reply => ({ status, body: { error } });

async function handle(action: string, body: any, falKey: string): Promise<Reply> {
  const falHeaders = () => ({
    Authorization: `Key ${falKey}`,
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

    case "image": {
      if (!falKey) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = trackById(stored.track);
      const out: any = await falRun(IMAGE_MODEL, {
        prompt: `${track.style}: ${body.prompt}`,
        image_size: "square_hd",
        num_images: 1,
        enable_safety_checker: true,
      });
      const url = out?.images?.[0]?.url;
      if (!url) return fail("fal returned no image", 502);
      await writeData(MIRIS_DIR, { prompt: body.prompt, imageUrl: url });
      return ok({ url });
    }

    case "model": {
      if (!falKey) return fail("FAL_KEY is not set in .env.local");
      const out: any = await falRun(
        MODEL_3D,
        { image_url: body.imageUrl, texture_prompt: body.prompt ?? "", ...MESHY_INPUT },
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

export function mirisDevApi(env: Record<string, string>): Plugin {
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
            return send(res, await handle(String(body.action ?? ""), body, env.FAL_KEY ?? ""));
          }

          next();
        } catch (e) {
          send(res, fail((e as Error).message, 500));
        }
      });
    },
  };
}
