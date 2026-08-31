import { STEPS } from "./curriculum";
import { TRACKS } from "./tracks";

export default function Start({ onChoose }: { onChoose: (id: string) => void }) {
  return (
    <div className="mw-start">
      <header>
        <span>Miris · Spatial Streaming</span>
      </header>

      <div className="mw-ask">
        <h1>What are you making?</h1>
        <p>
          Two hours, five steps. You describe one thing, watch it get built, then publish it streaming to anyone with
          the link.
        </p>
      </div>

      <div className="mw-doors">
        {TRACKS.map((track, i) => (
          <button
            key={track.id}
            className="mw-door"
            style={{ ["--a" as string]: track.accent, ["--i" as string]: i, ["--focal" as string]: track.focal } as React.CSSProperties}
            onClick={() => onChoose(track.id)}
          >
            {/* The renders are on a pure black ground with no alpha, so the CSS
                screen-blends them: the artwork's black resolves to the page's
                own ground and the subject reads as lit by the same room. */}
            <span className="mw-specimen">
              <img
                src={track.image}
                alt={track.imageAlt}
                width={track.imageWidth}
                height={track.imageHeight}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </span>

            <span className="mw-rail" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>

            <span className="mw-door-body">
              <b>{track.label}</b>
              <p>{track.blurb}</p>
              <span className="mw-begin">Start with {track.label} &rarr;</span>
            </span>
          </button>
        ))}
      </div>

      <footer>
        {STEPS.map((step) => (
          <span key={step.num}>
            <code>{step.num}</code> {step.title} <em>{step.time.replace(" min", "")}</em>
          </span>
        ))}
      </footer>
    </div>
  );
}
