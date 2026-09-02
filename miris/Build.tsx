import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PORTAL_URL } from "./config";
import type { Track } from "./tracks";

type Phase = "idle" | "image" | "review" | "model" | "done";

const GRID = 16;
// Must match the mw-dot duration in guide.css: the delays are fractions of it.
const WAVE = 3.2;

/* A dot grid rather than a shimmering block. Delay runs off (x + y), so the
   crest travels the diagonal, and each dot carries the wave in both its scale
   and its opacity. Negative delays start every dot mid-cycle, so the wave is
   already moving on the first frame. */
function DotWave() {
  const step = 100 / GRID;
  const dots = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={(x + 0.5) * step}
          cy={(y + 0.5) * step}
          r={step / 7}
          style={{ animationDelay: `${(-(x + y) / (GRID * 2 - 2)) * WAVE}s` }}
        />,
      );
    }
  }
  return (
    <svg className="mw-skel" viewBox="0 0 100 100" aria-hidden="true">
      {dots}
    </svg>
  );
}

/* The state lives above the steps, in Guide. It used to live inside step 1.2's
 * card, which unmounted the moment anyone advanced: step 2.3 tells attendees to
 * make their Miris account while the model builds, so the four minute job lost
 * its entire UI at exactly the point the curriculum sends them away from it. */
export function useBuild(track: Track) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [glb, setGlb] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [again, setAgain] = useState(false);
  const [small, setSmall] = useState(false);

  // Both URLs are already on disk, written by the dev API. Without this, a
  // reload loses a $1.40 result that is sitting in data.json.
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
    setAgain(false);
    setPhase("image");
    try {
      const { url } = await call("image", { prompt });
      setImage(url);
      setPhase("review");
      // A result that wants a decision opens itself, however it was left.
      setSmall(false);
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
      setSmall(false);
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

  return {
    track,
    phase,
    prompt,
    setPrompt,
    image,
    glb,
    error,
    elapsed,
    again,
    setAgain,
    small,
    setSmall,
    makeImage,
    makeModel,
    roll,
    reset: () => setPhase("idle"),
  };
}

export type BuildState = ReturnType<typeof useBuild>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The tray folds up into the bar and the bar opens back down, so one chevron
 *  turned two ways carries both directions. */
function Chevron({ up }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d={up ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** What the minimized bar says, and whether it should look busy. */
const status = (phase: Phase): { label: string; busy: boolean } => {
  if (phase === "image") return { label: "Drawing", busy: true };
  if (phase === "review") return { label: "Ready to review", busy: false };
  if (phase === "model") return { label: "Building the mesh", busy: true };
  return { label: "Model ready", busy: false };
};

function PromptField({ build }: { build: BuildState }) {
  const { track, prompt, setPrompt, roll, makeImage } = build;
  return (
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
      <button className="btn btn-primary btn-sm" disabled={!prompt.trim()} onClick={makeImage}>
        Generate
      </button>
    </>
  );
}

/** Step 1.2's card. Only the field: everything the generation produces goes to
 *  the tray, which outlives the step. */
export function BuildInput({ build }: { build: BuildState }) {
  return (
    <div className="mw-build">
      {build.phase === "idle" ? (
        <PromptField build={build} />
      ) : (
        <p className="mw-note">Working in the tray, to the left.</p>
      )}
      {build.error && <p className="mw-error">{build.error}</p>}
    </div>
  );
}

export default function BuildTray({ build }: { build: BuildState }) {
  const { track, phase, image, glb, error, elapsed, again, setAgain, small, setSmall, makeModel, reset } = build;
  if (phase === "idle") return null;

  const { label, busy } = status(phase);
  const clock = phase === "image" || phase === "model" ? mmss(elapsed) : null;

  if (small) {
    return createPortal(
      <button className="mw-tray-min" onClick={() => setSmall(false)} aria-expanded="false">
        <i className="mw-tray-dot" data-busy={busy || undefined} aria-hidden="true" />
        <span className="l12">{label}</span>
        {clock && <span className="mw-tray-clock">{clock}</span>}
        <span className="mw-tray-chev">
          <Chevron />
        </span>
      </button>,
      document.body,
    );
  }

  return createPortal(
    <aside className="mw-tray" role="dialog" aria-label={`Building your ${track.noun}`}>
      <header className="mw-tray-head">
        <i className="mw-tray-dot" data-busy={busy || undefined} aria-hidden="true" />
        <span className="mw-tray-eb l12">{again ? "Describe another" : label}</span>
        <button className="mw-tray-fold" onClick={() => setSmall(true)} aria-label="Minimize the tray">
          <Chevron up />
        </button>
      </header>

      {phase === "image" && (
        <>
          <div className="mw-loading">
            <DotWave />
            <p className="mw-elapsed">{clock}</p>
          </div>
          <p className="mw-note">About a minute.</p>
        </>
      )}

      {phase === "review" && (
        <>
          <img src={image} alt="Generated concept" />
          {again ? (
            <>
              <PromptField build={build} />
              <button className="btn btn-ghost btn-sm" onClick={() => setAgain(false)}>
                Cancel
              </button>
            </>
          ) : (
            <div className="mw-row">
              <button className="btn btn-primary btn-sm" onClick={makeModel}>
                Submit for 3D
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setAgain(true)}>
                Try again
              </button>
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {phase === "model" && (
        <>
          <div className="mw-loading">
            <DotWave />
            <p className="mw-elapsed">{clock}</p>
          </div>
          <div className="mw-stages">
            <div data-on>fal queued the job</div>
            <div data-on={elapsed > 8 || undefined}>reconstructing geometry</div>
            <div data-on={elapsed > 90 || undefined}>baking textures</div>
            <div data-on={elapsed > 200 || undefined}>packing the mesh</div>
          </div>
          <p className="mw-note">Four to six minutes. Make your Miris account while you wait.</p>
          <a className="btn btn-secondary btn-sm mw-goto" href={PORTAL_URL} target="_blank" rel="noopener">
            Open Miris &rarr;
          </a>
          <p className="mw-note">Safe to minimize. The result is saved, and a reload brings it back.</p>
        </>
      )}

      {phase === "done" && (
        <>
          <img src={image} alt="Your concept" />
          <a className="btn btn-primary btn-sm mw-goto" href={glb} download target="_blank" rel="noopener">
            Download .glb
          </a>
          <p className="mw-note">Upload this file in the Miris portal, then come back to step 4.</p>
        </>
      )}

      {error && <p className="mw-error">{error}</p>}
    </aside>,
    document.body,
  );
}
