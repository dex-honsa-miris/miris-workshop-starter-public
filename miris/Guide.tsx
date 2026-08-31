"use client";
import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Panel from "./Panel";
import { STEPS } from "./curriculum";
import { stepOfSub } from "./progress";
import Rail from "./Rail";
import StepPane, { type StepActions } from "./Step";
import { MARKER_FOR } from "./snippets.mjs";
import { trackById } from "./tracks";
import Start from "./Start";
import "./guide.css";

export default function MirisGuide() {
  const [open, setOpen] = useState(true);
  const [panel, setPanel] = useState(false);
  const [data, setData] = useState<any>({ step: "1.1" });
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  // View state, deliberately separate from data.step. data.step is how far the
  // attendee has actually got; `selected` is only which step the pane shows.
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/miris");
      const json = await res.json();
      // A 500 body is still valid JSON, so without this check the guide would
      // quietly render an error object as its state.
      if (!res.ok) return setNote(json.error ?? `could not read data.json (${res.status})`);
      setData(json);
    } catch (e) {
      setNote(`could not reach the workshop API: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (payload: object) => {
    const res = await fetch("/api/miris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, json: await res.json() };
  };

  const fill = async (snippetId: string, num: string) => {
    setBusy(num);
    setNote("");
    try {
      const { ok, json } = await post({ action: "fill", snippetId });
      if (!ok) return setNote(json.error);
      setNote("Written into app/stage.tsx");
      await post({ action: "save", patch: { step: num } });
      await load();
    } catch (e) {
      setNote(`Could not write the file: ${(e as Error).message}`);
    } finally {
      // Without the finally, a dev server mid-recompile leaves this button
      // disabled and reading "Writing" until a page reload.
      setBusy("");
    }
  };

  const clear = async (snippetId: string) => {
    try {
      const marker = MARKER_FOR[snippetId] ?? "scene";
      const { ok, json } = await post({ action: "reset", marker });
      setNote(ok ? `Cleared the ${marker} block. Re-fill the last step to bring it back.` : json.error);
    } catch (e) {
      setNote(`Could not clear the block: ${(e as Error).message}`);
    }
  };

  const track = trackById(data.track);
  const trackVars = { ["--track" as string]: track.accent } as React.CSSProperties;

  // Swapping between the chooser and the panel is a view transition, so the
  // door's artwork morphs into the sidebar's art strip rather than one screen
  // cutting to the other. Both elements carry view-transition-name track-art.
  //
  // The commit has to be synchronous inside the callback, hence flushSync: the
  // browser snapshots the DOM before and after that callback runs, and a
  // normal async setState would land after the snapshot and animate nothing.
  const chooseTrack = async (id: string) => {
    const { ok, json } = await post({ action: "save", patch: { track: id } });
    if (!ok) return setNote(json.error);

    let next: any;
    try {
      const res = await fetch("/api/miris");
      next = await res.json();
      if (!res.ok) return setNote(next.error ?? `could not read data.json (${res.status})`);
    } catch (e) {
      return setNote(`could not reach the workshop API: ${(e as Error).message}`);
    }

    const commit = () => flushSync(() => setData(next));
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    // Unsupported browsers get the same state change without the morph.
    if (typeof doc.startViewTransition === "function") doc.startViewTransition(commit);
    else commit();
  };

  // Only 5 of the 16 substeps carry a `fill`, and fill() was the sole writer of
  // data.step. With every substep on screen that was cosmetic; with one step in
  // view it would pin an attendee to step 01 for the whole workshop.
  const advance = async (toSubNum: string) => {
    setNote("");
    const { ok, json } = await post({ action: "save", patch: { step: toSubNum } });
    if (!ok) return setNote(json.error);
    setSelected(null);
    await load();
  };

  const saveField = async (field: "uuid" | "viewerKey", value: string) => {
    await post({ action: "save", patch: { [field]: value } });
    await load();
    setNote("Saved. Reload the page to stream it.");
  };

  const progressStep = stepOfSub(data.step ?? "1.1");
  const shownStep = selected
    ? STEPS.find((s) => s.num === selected) ?? progressStep
    : progressStep;

  const actions: StepActions = {
    fill,
    clear,
    openPanel: () => setPanel(true),
    saveField,
    advance,
    backToProgress: () => setSelected(null),
  };

  if (!data.track) return <Start onChoose={chooseTrack} />;

  if (!open) {
    return (
      <button className="mw-tab" style={trackVars} onClick={() => setOpen(true)}>
        Guide
      </button>
    );
  }

  return (
    <>
      {panel && <Panel track={track} onClose={() => setPanel(false)} />}
      <aside className="mw-panel" style={trackVars}>
        <header className="mw-head">
          <b className="b14">Spatial streaming</b>
          <button className="mw-hide" onClick={() => setOpen(false)} aria-label="Hide the guide">
            ×
          </button>
        </header>

        {/* The chosen specimen carries into the sidebar as a full-width strip,
            so the choice stays visible for the whole workshop. Same screen
            blend and dissolve as the chooser, and the same
            view-transition-name, which is what lets the door's art morph into
            this strip when a track is picked. */}
        <div className="mw-bar">
          <img
            className="mw-bar-art"
            src={track.image}
            alt=""
            aria-hidden="true"
          />
          <span className="mw-bar-label">{track.label}</span>
          <button className="mw-bar-change" onClick={() => chooseTrack("")}>
            Change
          </button>
        </div>

        <div className="mw-split">
          <Rail
            progressStepNum={progressStep.num}
            shownStepNum={shownStep.num}
            onSelect={setSelected}
          />
          <div className="mw-scroll">
            <StepPane
              step={shownStep}
              currentSubNum={data.step ?? "1.1"}
              data={data}
              track={track}
              busy={busy}
              actions={actions}
            />
          </div>
        </div>

        {note && <footer className="mw-note-bar">{note}</footer>}
      </aside>
    </>
  );
}
