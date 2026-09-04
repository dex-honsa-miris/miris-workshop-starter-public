import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chevron from "./Chevron";
import { PORTAL_URL } from "./config";
import type { Track } from "./tracks";

type Phase = "idle" | "image" | "review" | "model" | "done";

/* The same three slots store.mjs writes, restated for the browser. store.mjs
   imports node:fs, so the client cannot take PIECE_IDS from it without pulling
   node builtins into the bundle. A drift between the two copies cannot pass
   silently: the dev API validates every piece id against its own list and
   rejects an unknown one before it touches fal. */
export const PIECE_IDS = ["01", "02", "03"];

/* What a track change writes back into a slot: emptyPiece in store.mjs without
   its id, because the id addresses the slot rather than travelling in the
   patch. */
export const EMPTY_PIECE = {
  status: "empty",
  prompt: "",
  imageUrl: "",
  falRequestId: "",
  modelStartedAt: 0,
  glb: "",
  uuid: "",
  card: null,
};

/** One slot in data.json's `pieces`, as the dev API writes it. */
export interface Piece {
  id: string;
  status: string;
  prompt: string;
  imageUrl: string;
  falRequestId: string;
  modelStartedAt: number;
  glb: string;
  uuid: string;
  card: { name: string; description: string; attributes: string[] } | null;
}

/** Only the part of the document a build reads. Guide owns the whole thing. */
type Doc = { pieces?: Piece[] };

// Past this, a recorded build start is stale rather than in flight: falRun
// itself gives up at 25 minutes.
const RESUME_WINDOW = 30 * 60_000;

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

/* A shuffle bag, not a fresh draw: uniform draws from a small pool ping-pong
   between the same few phrases, which reads as a broken dice. Dealing the whole
   deck before any repeat is what people mean by random.

   One deck for the boutique rather than one per piece. Three independent bags
   can deal the same phrase into all three niches, and all three prompts are on
   screen together, so that is the exact repeat the bag exists to prevent. Keyed
   by track, because a different track is a different deck. */
const decks = new Map<string, string[]>();

function deal(track: Track, avoid: string) {
  let bag = decks.get(track.id);
  if (!bag || bag.length === 0) {
    bag = [...track.prompts];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    decks.set(track.id, bag);
  }
  let next = bag.pop()!;
  // The reshuffle seam can deal the phrase already in the box twice running.
  if (next === avoid && bag.length > 0) {
    bag.unshift(next);
    next = bag.pop()!;
  }
  return next;
}

/* One of these per piece, three in all, owned by Guide rather than by a step's
 * card: the mesh takes four to six minutes and the curriculum sends attendees
 * away from the prompt field while it runs, so a card-owned build lost its
 * entire UI at exactly the point it mattered.
 *
 * The document arrives as an argument rather than being fetched here. Guide
 * already reads the whole file, and three hooks polling the same endpoint would
 * triple the request rate for no new information. */
export function usePieceBuild(track: Track, pieceId: string, data: Doc) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [glb, setGlb] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [again, setAgain] = useState(false);
  // When the clock started, epoch ms. Comes back from data.json on a resume, so
  // the elapsed readout and the stage list survive a reload mid-build.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /* Bumped when a result actually arrives, and deliberately never on a resume.
     The tray reads it to unfold itself for a decision; a tray folded away
     before a reload must not spring open again on the way back. */
  const [landed, setLanded] = useState(0);

  const piece = data.pieces?.find((p) => p.id === pieceId);

  // Everything durable is already on disk, written by the dev API. Without
  // this, a reload loses a $1.40 result, and a reload MID-BUILD used to
  // resurrect as "Keep this one?", inviting a second $1.40 submit while the
  // first was still running server-side.
  //
  // Once per piece, not once per document. The same file arrives again on every
  // poll, and re-applying it would overwrite a prompt being typed and undo a
  // Cancel the attendee had just pressed.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !piece) return;
    resumed.current = true;
    if (piece.prompt) setPrompt(piece.prompt);
    if (piece.glb) {
      setImage(piece.imageUrl);
      setGlb(piece.glb);
      setPhase("done");
    } else if (
      piece.imageUrl &&
      piece.falRequestId &&
      piece.modelStartedAt &&
      Date.now() - piece.modelStartedAt < RESUME_WINDOW
    ) {
      setImage(piece.imageUrl);
      setStartedAt(piece.modelStartedAt);
      setPhase("model");
    } else if (piece.imageUrl) {
      setImage(piece.imageUrl);
      setPhase("review");
    }
  }, [piece]);

  useEffect(() => {
    if (phase !== "model" && phase !== "image") return;
    const base = phase === "model" && startedAt ? startedAt : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  /* The POST that started the build dies with the page, but the dev server
     keeps polling fal and writes glb into this slot when it lands. While the
     tray shows "building", watch the document Guide is polling: it is the only
     path a resumed page has to its own result. */
  const recorded = useRef(false);
  useEffect(() => {
    if (phase !== "model" || !piece) return;
    if (piece.glb) {
      setGlb(piece.glb);
      setImage(piece.imageUrl);
      setPhase("done");
      setLanded((n) => n + 1);
      return;
    }
    /* The server sets modelStartedAt once fal accepts the job and clears it
       again when fal reports failure, so a zero means failure only after a
       start has actually been seen. A submit flips this hook to "model" before
       either has happened; without the latch the first poll to arrive in that
       gap reads the zero the slot has always held and reports a failure that
       never occurred. */
    if (piece.modelStartedAt) recorded.current = true;
    else if (recorded.current) {
      setError("The build failed on fal. Submit again.");
      setPhase("review");
    }
  }, [phase, piece]);

  const call = async (action: string, extra: object) => {
    const res = await fetch("/api/miris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Every request carries its piece id. The dev API rejects an id outside
      // PIECE_IDS before it calls fal, and an omitted one would write this
      // piece's result into slot 01.
      body: JSON.stringify({ action, id: pieceId, ...extra }),
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
      // A result that wants a decision opens the tray, however it was left.
      setLanded((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const makeModel = async () => {
    setError("");
    recorded.current = false;
    setStartedAt(Date.now());
    setPhase("model");
    try {
      const { url } = await call("model", { imageUrl: image, prompt });
      setGlb(url);
      setPhase("done");
      setLanded((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
      setPhase("review");
    }
  };

  const roll = () => {
    setPrompt(deal(track, prompt.trim()));
    setError("");
  };

  return {
    pieceId,
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
    landed,
    makeImage,
    makeModel,
    roll,
    reset: () => setPhase("idle"),
  };
}

export type BuildState = ReturnType<typeof usePieceBuild>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const working = (phase: Phase) => phase === "image" || phase === "model";

/** What one piece's line says, and whether its dot should look busy. */
const status = (phase: Phase): { label: string; busy: boolean } => {
  if (phase === "image") return { label: "Drawing", busy: true };
  if (phase === "review") return { label: "Ready to review", busy: false };
  if (phase === "model") return { label: "Building the mesh", busy: true };
  return { label: "Model ready", busy: false };
};

/* What the tray as a whole says. One piece in flight keeps its own line, so a
   single build reads exactly as it did before there were three; several become
   a count, because three stacked labels in one header say less than a number
   does. The clock follows the piece that has been waiting longest. */
function trayStatus(builds: BuildState[]): { label: string; busy: boolean; clock: string | null } {
  const busy = builds.filter((b) => working(b.phase));
  const clock = busy.length ? mmss(Math.max(...busy.map((b) => b.elapsed))) : null;
  if (busy.length > 1) return { label: `${busy.length} pieces building`, busy: true, clock };
  if (busy.length === 1) return { ...status(busy[0].phase), clock };

  const review = builds.filter((b) => b.phase === "review").length;
  if (review) return { label: review > 1 ? `${review} to review` : "Ready to review", busy: false, clock };

  const done = builds.filter((b) => b.phase === "done").length;
  return { label: done > 1 ? `${done} models ready` : "Model ready", busy: false, clock };
}

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

/** The describing step's card. Only the fields: everything a generation
 *  produces goes to the tray, which outlives the step. One field per piece that
 *  has not been started yet, so the three can be described in any order. */
export function BuildInput({ builds }: { builds: BuildState[] }) {
  const waiting = builds.filter((b) => b.phase === "idle");
  return (
    <div className="mw-build">
      {waiting.length === 0 ? (
        <p className="mw-note">Working in the tray, to the left.</p>
      ) : (
        waiting.map((build) => (
          <Fragment key={build.pieceId}>
            <span className="mw-step">Piece {build.pieceId}</span>
            <PromptField build={build} />
            {build.error && <p className="mw-error">{build.error}</p>}
          </Fragment>
        ))
      )}
    </div>
  );
}

/* One piece's run of the tray. A fragment rather than a wrapper, so every part
 * stays a direct child of .mw-tray and keeps the column gap and the direct-child
 * margin rules guide.css already sets for it. */
function PiecePanel({ build }: { build: BuildState }) {
  const { pieceId, phase, image, glb, error, elapsed, again, setAgain, makeModel, reset } = build;
  const { label, busy } = status(phase);
  const clock = working(phase) ? mmss(elapsed) : null;

  return (
    <>
      <header className="mw-tray-head">
        <i className="mw-tray-dot" data-busy={busy || undefined} aria-hidden="true" />
        <span className="l12">{pieceId}</span>
        <span className="mw-tray-eb l12">{again ? "Describe another" : label}</span>
      </header>

      {phase === "image" && (
        <div className="mw-loading">
          <DotWave />
          <p className="mw-elapsed">{clock}</p>
        </div>
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
        </>
      )}

      {phase === "done" && (
        <>
          <img src={image} alt="Your concept" />
          <a className="btn btn-primary btn-sm mw-goto" href={glb} download target="_blank" rel="noopener">
            Download .glb
          </a>
        </>
      )}

      {error && <p className="mw-error">{error}</p>}
    </>
  );
}

export default function BuildTray({ builds }: { builds: BuildState[] }) {
  /* One tray means one fold, so this lives here rather than in the hook: three
     copies of it would fight over the same sessionStorage key. It survives the
     reload a Fill triggers, because a tray someone folded away should not
     spring back open when they press a paste button two steps later. */
  const [small, setSmall] = useState(() => {
    try {
      return sessionStorage.getItem("mw-tray-min") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem("mw-tray-min", small ? "1" : "0");
    } catch {
      // Blocked storage costs the convenience, not the tray.
    }
  }, [small]);

  /* A result that wants a decision opens the tray, however it was left. Driven
     by the counters rather than by the phases, so only a result that arrives
     while the page is open unfolds it: a reload restores the phases too, and
     reading those would undo the fold the attendee chose. */
  const landed = builds.reduce((n, b) => n + b.landed, 0);
  const seen = useRef(landed);
  useEffect(() => {
    if (landed > seen.current) setSmall(false);
    seen.current = landed;
  }, [landed]);

  const active = builds.filter((b) => b.phase !== "idle");
  if (active.length === 0) return null;

  const { label, busy, clock } = trayStatus(active);
  const meshing = active.some((b) => b.phase === "model");
  const drawing = active.some((b) => b.phase === "image");

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
    <aside className="mw-tray" role="dialog" aria-label="Building your pieces">
      <header className="mw-tray-head">
        <i className="mw-tray-dot" data-busy={busy || undefined} aria-hidden="true" />
        <span className="mw-tray-eb l12">{label}</span>
        <button className="mw-tray-fold" onClick={() => setSmall(true)} aria-label="Minimize the tray">
          <Chevron up />
        </button>
      </header>

      {active.map((build) => (
        <PiecePanel key={build.pieceId} build={build} />
      ))}

      {/* Said once for the tray, not once per piece: with three builds in
          flight the same three sentences would be on screen three times. */}
      {meshing && (
        <>
          <p className="mw-note">Four to six minutes. Make your Miris account while you wait.</p>
          <a className="btn btn-secondary btn-sm mw-goto" href={PORTAL_URL} target="_blank" rel="noopener">
            Open Miris &rarr;
          </a>
        </>
      )}
      {drawing && !meshing && <p className="mw-note">About a minute.</p>}
      {(meshing || drawing) && (
        <p className="mw-note">Safe to minimize. Every result is saved, and a reload brings it back.</p>
      )}
    </aside>,
    document.body,
  );
}
