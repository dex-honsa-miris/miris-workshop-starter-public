import { useEffect, useState } from "react";
import { PORTAL_URL } from "./config";
import type { Track } from "./tracks";

type Phase = "idle" | "image" | "review" | "model" | "done";

export default function Build({ track }: { track: Track }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [glb, setGlb] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Both URLs are already on disk, written by the route. Without this, closing
  // leaving step 1.2 loses a $1.40 result that is sitting in data.json.
  useEffect(() => {
    fetch("/api/miris")
    .then((r) => r.json())
    .then((d) => {
      if (d?.prompt) setPrompt(d.prompt);
      if (d?.glb) {
        setImage(d.imageUrl ?? "");
        setGlb(d.glb);
        setPhase("done");
      } else if (d?.imageUrl) {
        setImage(d.imageUrl);
        setPhase("review");
      }
    })
    .catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "model" && phase !== "image") return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const call = async (action: string, extra: object) => {
    const res = await fetch("/api/miris", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `request failed: ${res.status}`);
    return json;
  };

  const makeImage = async () => {
    setError("");
    setPhase("image");
    try {
    const { url } = await call("image", { prompt });
    setImage(url);
    setPhase("review");
    } catch (e) {
    setError((e as Error).message);
    setPhase("idle");
    }
  };

  const makeModel = async () => {
    setError("");
    setPhase("model");
    try {
    const { url } = await call("model", { imageUrl: image, prompt });
    setGlb(url);
    setPhase("done");
    } catch (e) {
    setError((e as Error).message);
    setPhase("review");
    }
  };

  // Excludes whatever is already in the box: a dice that hands back the same
  // phrase reads as broken rather than random.
  const roll = () => {
    const pool = track.prompts.filter((p) => p !== prompt.trim());
    setPrompt(pool[Math.floor(Math.random() * pool.length)] ?? track.prompts[0]);
    setError("");
  };

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="mw-build">
      {(phase === "idle" || phase === "image") && (
        <>
          <div className="mw-prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={track.hint}
            />
            <button
              type="button"
              className="mw-dice"
              onClick={roll}
              disabled={phase === "image"}
              title={`Suggest a ${track.noun}`}
              aria-label={`Suggest a ${track.noun}`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
                <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" />
                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                <circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" />
                <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" />
              </svg>
            </button>
          </div>
          <button className="btn btn-primary btn-sm" disabled={phase === "image" || !prompt.trim()} onClick={makeImage}>
            {phase === "image" ? "Drawing" : "Generate"}
          </button>
          {phase === "image" && (
            <>
              <p className="mw-elapsed">{mmss}</p>
              <p className="mw-note">About a minute.</p>
            </>
          )}
        </>
      )}

      {phase === "review" && (
        <>
          <h3>Keep this one?</h3>
          <img src={image} alt="Generated concept" />
          <p className="mw-note">Rerolls cost five cents. The next step costs $1.40, so choose here.</p>
          <div className="mw-row">
            <button className="btn btn-ghost btn-sm" onClick={makeImage}>
              Reroll
            </button>
            <button className="btn btn-primary btn-sm" onClick={makeModel}>
              Submit for 3D
            </button>
          </div>
        </>
      )}

      {phase === "model" && (
        <>
          <span className="mw-step">Building</span>
          <h3>Four to six minutes</h3>
          <p className="mw-elapsed">{mmss}</p>
          <div className="mw-stages">
            <div data-on>fal queued the job</div>
            <div data-on={elapsed > 8 || undefined}>reconstructing geometry</div>
            <div data-on={elapsed > 90 || undefined}>baking textures</div>
            <div data-on={elapsed > 200 || undefined}>packing the mesh</div>
          </div>
          <img src={image} alt="Your concept" className="mw-dim" />
          <p className="mw-note">
            Use the time: make your Miris account now, because you need it two steps from here.
          </p>
          <a className="btn btn-secondary btn-sm mw-goto" href={PORTAL_URL} target="_blank" rel="noopener">
            Open the Miris portal
          </a>
          <p className="mw-note">
            Safe to leave this. The result is saved, and a reload brings it back.
          </p>
        </>
      )}

      {phase === "done" && (
        <>
          <span className="mw-step">Ready</span>
          <h3>Your {track.noun} is built</h3>
          <img src={image} alt="Your concept" />
          <a className="btn btn-primary btn-sm mw-goto" href={glb} download target="_blank" rel="noopener">
            Download .glb
          </a>
          <p className="mw-note">Upload this file in the Miris portal, then come back to step 4.</p>
        </>
      )}

      {error && <p className="mw-error">{error}</p>}
    </div>
  );
}
