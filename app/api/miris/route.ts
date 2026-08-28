import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { replaceMarker } from "../../../miris/markers.mjs";
import { readData, writeData } from "../../../miris/store.mjs";
import { MARKER_FOR, SNIPPETS } from "../../../miris/snippets.mjs";
import { IMAGE_MODEL, MODEL_3D } from "../../../miris/config";
import { trackById } from "../../../miris/tracks";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
const TEMPLATE = join(MIRIS_DIR, "stage.template.tsx");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const falHeaders = () => ({
  Authorization: `Key ${process.env.FAL_KEY}`,
  "Content-Type": "application/json",
});

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

// Attendees publish this app and share the link (step 5.3), and commenting out
// the guide does not remove this route. Writing files and spending someone's fal
// key are development-only powers.
const devOnly = () =>
  process.env.NODE_ENV === "development"
    ? null
    : json({ error: "the workshop API only runs in development" }, 403);

export async function GET() {
  const blocked = devOnly();
  if (blocked) return blocked;
  try {
    return json(await readData(MIRIS_DIR));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

export async function POST(request: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }

  try {
    switch (body.action) {
      case "fill": {
        const snippet = SNIPPETS[body.snippetId as keyof typeof SNIPPETS];
        const marker = MARKER_FOR[body.snippetId as keyof typeof MARKER_FOR];
        if (!snippet) return json({ error: `unknown snippet: ${body.snippetId}` }, 400);
        const source = await readFile(STAGE, "utf8");
        await writeFile(STAGE, replaceMarker(source, marker, snippet));
        return json({ ok: true, marker });
      }

      case "reset": {
        const marker = String(body.marker ?? "");
        const template = await readFile(TEMPLATE, "utf8");
        const open = `{/* miris:${marker}-start */}`;
        const close = `{/* miris:${marker}-end */}`;
        const a = template.indexOf(open);
        const b = template.indexOf(close);
        if (a === -1 || b === -1) return json({ error: `unknown marker: ${marker}` }, 400);
        const blank = template.slice(a + open.length, b).trim();
        const source = await readFile(STAGE, "utf8");
        await writeFile(STAGE, replaceMarker(source, marker, blank));
        return json({ ok: true, marker });
      }

      case "save":
        return json(await writeData(MIRIS_DIR, body.patch ?? {}));

      case "image": {
        if (!process.env.FAL_KEY) return json({ error: "FAL_KEY is not set in .env.local" }, 400);
        const stored = await readData(MIRIS_DIR);
        const track = trackById(stored.track);
        const out: any = await falRun(IMAGE_MODEL, {
          prompt: `${track.style}: ${body.prompt}`,
          image_size: "square_hd",
          num_images: 1,
          enable_safety_checker: true,
        });
        const url = out?.images?.[0]?.url;
        if (!url) return json({ error: "fal returned no image" }, 502);
        await writeData(MIRIS_DIR, { prompt: body.prompt, imageUrl: url });
        return json({ url });
      }

      case "model": {
        if (!process.env.FAL_KEY) return json({ error: "FAL_KEY is not set in .env.local" }, 400);
        const out: any = await falRun(
          MODEL_3D,
          { image_url: body.imageUrl, texture_prompt: body.prompt ?? "", ...MESHY_INPUT },
          MIRIS_DIR,
        );
        const url = out?.model_glb?.url;
        if (!url) return json({ error: "fal returned no mesh" }, 502);
        await writeData(MIRIS_DIR, { glb: url });
        return json({ url });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}

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
