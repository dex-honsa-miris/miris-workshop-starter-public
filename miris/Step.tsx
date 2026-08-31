"use client";
import type { Step, Sub } from "./curriculum";
import type { Track } from "./tracks";
import { nextSub, subState } from "./progress";

export interface StepActions {
  fill: (snippetId: string, num: string) => void | Promise<void>;
  clear: (snippetId: string) => void | Promise<void>;
  openPanel: () => void;
  saveField: (field: "uuid" | "viewerKey", value: string) => void | Promise<void>;
  /** Moves the persisted progress pointer. */
  advance: (toSubNum: string) => void | Promise<void>;
  /** Returns the pane to whichever step actually holds the pointer. */
  backToProgress: () => void;
}

export interface StepPaneProps {
  /** The step being displayed, which is not always the step holding the pointer. */
  step: Step;
  /** data.step, the persisted progress pointer. */
  currentSubNum: string;
  data: { uuid?: string; viewerKey?: string };
  track: Track;
  /** Substep number currently being written, or "". */
  busy: string;
  actions: StepActions;
}

export default function StepPane({
  step,
  currentSubNum,
  data,
  track,
  busy,
  actions,
}: StepPaneProps) {
  // Browsing ahead via the rail shows a step that holds no current substep. The
  // forward button belongs to the pointer, not to whatever is on screen, so
  // offering "next" here would name a substep from a different step entirely.
  const isProgressStep = step.subs.some((s) => s.num === currentSubNum);
  const upNext = isProgressStep ? nextSub(currentSubNum) : undefined;

  return (
    <div className="mw-pane">
      <p className="l12 mw-pane-time">{step.time}</p>
      <h2 className="t20 mw-pane-title">{step.title}</h2>

      {step.subs.map((sub: Sub) => {
        const state = subState(sub.num, currentSubNum);

        if (state !== "here") {
          return (
            <div key={sub.num} className="mw-line" data-state={state}>
              <span className="l12 k">{sub.num}</span>
              <span className="c14 ttl">{sub.title}</span>
              {state === "done" && (
                <span className="tick" aria-hidden="true">
                  &#10003;
                </span>
              )}
            </div>
          );
        }

        return (
          <article key={sub.num} className="mw-now">
            <div className="mw-now-eb">
              <p className="l12">Step {sub.num}</p>
              <span className="mw-lod" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
            </div>

            <h3 className="mw-now-title">{sub.title}</h3>
            <p className="c14">{sub.body}</p>
            {sub.code && <pre className="k14">{sub.code}</pre>}

            {sub.panel && (
              <button className="btn btn-primary btn-sm" onClick={actions.openPanel}>
                Describe your {track.noun}
              </button>
            )}

            {sub.fill && (
              <div className="mw-row">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === sub.num}
                  onClick={() => actions.fill(sub.fill!, sub.num)}
                >
                  {busy === sub.num ? "Writing" : "Fill in app/stage.tsx"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => actions.clear(sub.fill!)}
                >
                  Clear block
                </button>
              </div>
            )}

            {sub.fields && (
              <div className="fld mw-fields">
                <label>
                  Asset uuid
                  <input
                    key={`uuid-${data.uuid ?? ""}`}
                    defaultValue={data.uuid ?? ""}
                    placeholder="2b21e89f-ef5d-4175-bbdf-03e8649bcb76"
                    onBlur={(e) => actions.saveField("uuid", e.target.value.trim())}
                  />
                </label>
                <label>
                  Viewer key
                  <input
                    key={`key-${data.viewerKey ?? ""}`}
                    defaultValue={data.viewerKey ?? ""}
                    placeholder="leave empty to use the demo key"
                    onBlur={(e) => actions.saveField("viewerKey", e.target.value.trim())}
                  />
                </label>
              </div>
            )}

            {sub.explain && (
              <p className="mw-why">
                <b className="l12">Why</b>
                {sub.explain}
              </p>
            )}
          </article>
        );
      })}

      {upNext && (
        <button
          className="btn btn-secondary btn-sm mw-next"
          onClick={() => actions.advance(upNext.num)}
        >
          Next: {upNext.num} {upNext.title} &rarr;
        </button>
      )}

      {!isProgressStep && (
        <button className="btn btn-ghost btn-sm mw-next" onClick={actions.backToProgress}>
          Back to step {currentSubNum}
        </button>
      )}
    </div>
  );
}
