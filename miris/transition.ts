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
 *  Never let the animation decide whether the app advances: an unsupported
 *  browser and a thrown transition both fall through to committing. */
export function transition(commit: () => void) {
  const doc = document as WithVT;
  if (typeof doc.startViewTransition !== "function") return commit();

  try {
    doc.startViewTransition(() => flushSync(commit));
  } catch {
    commit();
  }
}

/** Stable per substep, and the same on the line and the card so the browser
 *  pairs them. Dots are not valid in a custom-ident. */
export const subName = (num: string) => `sub-${num.replace(/\./g, "-")}`;
