import { flushSync } from "react-dom";

type WithVT = Document & {
  startViewTransition?: (cb: () => void) => {
    finished?: Promise<void>;
    updateCallbackDone?: Promise<void>;
  };
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
    /* Both promises get a catch. A view transition rejects ASYNCHRONOUSLY --
       "Transition was aborted because of invalid state" when the document is
       hidden, or when a second transition starts before this one settles -- and
       an async rejection is not something the try/catch below can see. Left
       unhandled it reaches the console as an uncaught InvalidStateError, which
       is alarming, is not actionable, and is not even a real failure: the DOM
       has already been committed by the callback. */
    const running = doc.startViewTransition(() => flushSync(commit));
    running?.finished?.catch(() => {});
    running?.updateCallbackDone?.catch(() => {});
  } catch {
    commit();
  }
}

/** Stable per substep, and the same on the line and the card so the browser
 *  pairs them. Dots are not valid in a custom-ident. */
export const subName = (num: string) => `sub-${num.replace(/\./g, "-")}`;
