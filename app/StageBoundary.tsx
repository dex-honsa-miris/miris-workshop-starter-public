import { Component, type ReactNode } from "react";

/* Keeps a broken stage from taking the guide with it.
 *
 * Vite's overlay already covers syntax errors. This is for the runtime kind:
 * without a boundary React unmounts the whole root, so the panel holding the
 * instructions for fixing the problem disappears at the exact moment it is
 * needed. A class is the only way to catch that; there is no hook equivalent. */
export default class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mw-fault">
        <p className="l12">Stopped rendering</p>
        <h1 className="t32">The stage threw</h1>
        <p className="c16">
          Check the browser console for the line, fix app/stage.tsx, and it will
          reload. Your progress is saved in miris/data.json.
        </p>
      </main>
    );
  }
}
