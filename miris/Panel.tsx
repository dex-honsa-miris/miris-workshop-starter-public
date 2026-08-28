"use client";
import { useEffect, useState } from "react";
import { CONSOLE_URL } from "./config";
import type { Track } from "./tracks";

type Phase = "idle" | "image" | "review" | "model" | "done";

export default function Panel({ track, onClose }: { track: Track; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [glb, setGlb] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  // Both URLs are already on disk, written by the route. Without this, closing
  // the panel loses a $1.40 result that is sitting in data.json.
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
    if (phase !== "model") return;
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

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  const accent = { ["--accent" as string]: track.accent } as React.CSSProperties;

  return (
    <div className="mw-overlay" style={accent}>
      <div className="mw-card">
        <button className="mw-x" onClick={onClose} aria-label="Close">
          ×
        </button>

        {(phase === "idle" || phase === "image") && (
          <>
            <span className="mw-step">{track.label} · step 1.2</span>
            <h3>Describe your {track.noun}</h3>
            <p className="mw-note">
              One subject, centered, plain backdrop. Ask for what splats carry well: fur, membrane, gilt, patina, worn
              stone.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={track.hint}
            />
            <button className="mw-go" disabled={phase === "image" || !prompt.trim()} onClick={makeImage}>
              {phase === "image" ? "Drawing" : "Generate"}
            </button>
            {phase === "image" && <div className="mw-spinner" />}
          </>
        )}

        {phase === "review" && (
          <>
            <span className="mw-step">{track.label} · step 1.2</span>
            <h3>Keep this one?</h3>
            <img src={image} alt="Generated concept" />
            <p className="mw-note">Rerolls cost fractions of a cent. The next step costs about $1.40 and takes minutes,
              so choose here rather than there.</p>
            <div className="mw-row">
              <button onClick={makeImage}>Reroll</button>
              <button className="mw-go" onClick={makeModel}>
                Submit for 3D
              </button>
            </div>
          </>
        )}

        {phase === "model" && (
          <>
            <span className="mw-step">{track.label} · building</span>
            <h3>About four minutes</h3>
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
            <a className="mw-go" href={CONSOLE_URL} target="_blank" rel="noopener">
              Open the Miris console
            </a>
            <p className="mw-note">
              Safe to close this. Your result is saved, and reopening the panel brings it back.
            </p>
          </>
        )}

        {phase === "done" && (
          <>
            <span className="mw-step">{track.label} · ready</span>
            <h3>Your {track.noun} is built</h3>
            <img src={image} alt="Your concept" />
            <a className="mw-go" href={glb} download target="_blank" rel="noopener">
              Download .glb
            </a>
            <p className="mw-note">Upload this file in the Miris console, then come back to step 4.</p>
          </>
        )}

        {error && <p className="mw-error">{error}</p>}
      </div>
    </div>
  );
}
