import { Component, type ReactNode } from "react";

// Without this, a runtime error in the stage unmounts the guide too.
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
