import { STEPS, type Step } from "./curriculum";

export interface RailProps {
  /** Step that owns the persisted progress pointer. */
  progressStepNum: string;
  /** Step currently displayed in the pane, which may be a different one. */
  shownStepNum: string;
  onSelect: (stepNum: string) => void;
}

/* Deliberately NOT called .mw-rail: that class is already the track chooser's
   four-block LOD meter on each door, with its own hover cascade and entrance
   animation. Reusing the name turns every door's pips into a 52px column. */
export default function Rail({ progressStepNum, shownStepNum, onSelect }: RailProps) {
  const progressIndex = STEPS.findIndex((s) => s.num === progressStepNum);

  return (
    <nav className="mw-steprail" aria-label="Workshop steps">
      {STEPS.map((step: Step, i: number) => {
        const state = i < progressIndex ? "done" : i === progressIndex ? "now" : "ahead";
        return (
          <button
            key={step.num}
            className="mw-steptick"
            data-state={state}
            aria-current={step.num === shownStepNum ? "step" : undefined}
            aria-label={`Step ${step.num}, ${step.title}`}
            onClick={() => onSelect(step.num)}
          >
            <span className="l12">{step.num}</span>
            <em aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
