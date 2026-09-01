import { flushSync } from "react-dom";

type WithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

/** Commits a state change inside a view transition, so the browser can morph
 *  between two different elements: a substep's collapsed line and its expanded
 *  card are not the same node, which is why no CSS transition can cross them.
 *
 *  flushSync is required, not defensive. React batches, and startViewTransition
 *  snapshots the DOM when its callback returns, so a batched setState would be
 *  captured as "no change" and nothing would animate.
 *
 *  `direction` lands on html[data-vt] for the chooser, which gives closing its
 *  own curve. Never let the animation decide whether the app advances: an
 *  unsupported browser and a thrown transition both fall through to committing. */
export function transition(commit: () => void, direction?: "in" | "out") {
  const doc = document as WithVT;
  if (typeof doc.startViewTransition !== "function") return commit();

  const root = document.documentElement;
  if (direction) root.dataset.vt = direction;
  const clear = () => {
    if (direction) delete root.dataset.vt;
  };

  try {
    doc.startViewTransition(() => flushSync(commit)).finished.finally(clear);
  } catch {
    clear();
    commit();
  }
}

/** Stable per substep, and the same on the line and the card so the browser
 *  pairs them. Dots are not valid in a custom-ident. */
export const subName = (num: string) => `sub-${num.replace(/\./g, "-")}`;
