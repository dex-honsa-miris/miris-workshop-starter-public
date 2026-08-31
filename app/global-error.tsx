"use client";

/* Attendees edit app/stage.tsx live for two hours, so they WILL break it. Next
 * falls back to a synthetic global error page when the app defines none, and
 * that page is worth owning: it is the screen someone stares at when their
 * workshop stops working.
 *
 * global-error replaces the root layout entirely, which is why the kit is
 * linked again below. Without those links this page renders unstyled. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/kit/fonts.css" />
        <link rel="stylesheet" href="/kit/tokens.css" />
        <link rel="stylesheet" href="/kit/components.css" />
        <link rel="stylesheet" href="/kit/type-responsive.css" />
        <link rel="stylesheet" href="/kit/patterns.css" />
      </head>
      <body>
        <main className="mw-fault">
          <p className="l12">Stopped rendering</p>
          <h1 className="t32">Something in the page threw</h1>
          <p className="c16">
            The usual cause is the last edit to app/stage.tsx. Check the terminal
            for a line number, fix it, then try again. Your progress is saved in
            miris/data.json and is not affected.
          </p>
          {error.message && <pre className="k14 mw-fault-msg">{error.message}</pre>}
          {error.digest && <p className="l12 mw-fault-digest">Digest {error.digest}</p>}
          <button className="btn btn-secondary btn-sm" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
