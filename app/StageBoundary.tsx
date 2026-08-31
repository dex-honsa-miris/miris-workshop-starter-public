import { Component, type ErrorInfo, type ReactNode } from "react";

/* Attendees edit app/stage.tsx live for two hours, so they will break it. This
 * keeps the failure inside the stage: the guide panel stays up, which is where
 * the instructions for fixing it are.
 *
 * A class component because React error boundaries have no hook equivalent. */
export default class StageBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept, because the message alone rarely says which edit caused it.
    console.error("Stage failed to render:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="mw-fault">
        <p className="l12">Stopped rendering</p>
        <h1 className="t32">The stage threw</h1>
        <p className="c16">
          The usual cause is the last edit to app/stage.tsx. Check the browser
          console for a line number, fix it, then try again. Your progress is
          saved in miris/data.json and is not affected.
        </p>
        {error.message && <pre className="k14 mw-fault-msg">{error.message}</pre>}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </main>
    );
  }
}
