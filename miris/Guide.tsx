"use client";
import { useCallback, useEffect, useState } from "react";
import Panel from "./Panel";
import { STEPS } from "./curriculum";
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
  const accent = { ["--accent" as string]: track.accent } as React.CSSProperties;

  const chooseTrack = async (id: string) => {
    await post({ action: "save", patch: { track: id } });
    await load();
  };

  if (!data.track) return <Start onChoose={chooseTrack} />;

  if (!open) {
    return (
      <button className="mw-tab" style={accent} onClick={() => setOpen(true)}>
        Guide
      </button>
    );
  }

  return (
    <>
      {panel && <Panel track={track} onClose={() => setPanel(false)} />}
      <aside className="mw-panel" style={accent}>
        <header className="mw-head">
          <b className="b14">Spatial Streaming</b>
          <button className="mw-hide" onClick={() => setOpen(false)} aria-label="Hide the guide">
            ×
          </button>
        </header>

        <div className="mw-bar">
          {track.label}
          <button onClick={() => chooseTrack("")}>Change</button>
        </div>

        <div className="mw-scroll">
          {STEPS.map((step) => (
            <section key={step.num}>
              <h2>
                {step.num}
                <em>{step.title}</em>
                <span className="mw-mins l12">{step.time}</span>
              </h2>

              {step.subs.map((sub) => (
                <article
                  key={sub.num}
                  className="mw-sub"
                  data-state={data.step === sub.num ? "here" : data.step > sub.num ? "done" : "ahead"}
                >
                  <span className="mw-lod" aria-hidden="true">
                    <i /><i /><i /><i />
                  </span>
                  <div>
                  <h3>
                    <code className="l12">{sub.num}</code>
                    {sub.title}
                  </h3>
                  <p className="c14">{sub.body}</p>
                  {sub.code && <pre className="k14">{sub.code}</pre>}

                  {sub.panel && (
                    <button className="btn-primary btn-sm b12" onClick={() => setPanel(true)}>
                      Describe your {track.noun}
                    </button>
                  )}

                  {sub.fill && (
                    <div className="mw-row">
                      <button
                        className="btn-primary btn-sm b12"
                        disabled={busy === sub.num}
                        onClick={() => fill(sub.fill!, sub.num)}
                      >
                        {busy === sub.num ? "Writing" : "Fill in app/stage.tsx"}
                      </button>
                      <button className="btn-ghost btn-sm b12" onClick={() => clear(sub.fill!)}>
                        Clear block
                      </button>
                    </div>
                  )}

                  {sub.fields && (
                    <div className="mw-fields">
                      <label className="l12">
                        Asset uuid
                        <input
                          key={`uuid-${data.uuid ?? ""}`}
                          defaultValue={data.uuid ?? ""}
                          placeholder="2b21e89f-ef5d-4175-bbdf-03e8649bcb76"
                          onBlur={async (e) => {
                            await post({ action: "save", patch: { uuid: e.target.value.trim() } });
                            await load();
                            setNote("Saved. Reload the page to stream it.");
                          }}
                        />
                      </label>
                      <label className="l12">
                        Viewer key
                        <input
                          key={`key-${data.viewerKey ?? ""}`}
                          defaultValue={data.viewerKey ?? ""}
                          placeholder="leave empty to use the demo key"
                          onBlur={async (e) => {
                            await post({ action: "save", patch: { viewerKey: e.target.value.trim() } });
                            await load();
                            setNote("Saved. Reload the page to stream it.");
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {sub.explain && (
                    <p className="mw-why">
                      <b>Why</b>
                      {sub.explain}
                    </p>
                  )}
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>

        {note && <footer className="mw-note-bar">{note}</footer>}
      </aside>
    </>
  );
}
