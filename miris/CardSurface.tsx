import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CanvasTexture, SRGBColorSpace } from "three";
import { cardCss, paintElement } from "./htmlInCanvas";
import type { CardData } from "./Card";

/** Scene units per CSS pixel. A 200px card comes out 0.9 units wide, which is
 *  the width the drei overlay read as at the same position. */
const UNITS_PER_PX = 0.0045;

/** Fallback for --accent, which resolves from :root in guide.css. Read at paint
 *  time rather than hardcoded, so this stays correct if the cascade changes. */
const ACCENT_FALLBACK = "#35ddfe";

export default function CardSurface({ card }: { card: Partial<CardData> }) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const rootRef = useRef<Root | null>(null);

  // The canvas that both holds and displays the card. drawElementImage needs
  // the element to be a descendant of the canvas it draws onto, so the DOM goes
  // inside. Offscreen via `left`, never display:none: an unrendered element
  // never paints, and the native call throws without a paint snapshot.
  const host = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.setAttribute("layoutsubtree", "");
    c.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none";
    return c;
  }, []);

  useEffect(() => {
    if (!host) return;
    document.body.appendChild(host);
    // createRoot, not react-dom's createPortal: R3F's reconciler does not
    // handle DOM host components. This is the pattern drei's own <Html> uses,
    // at node_modules/@react-three/drei/web/Html.js:143.
    const root = createRoot(host);
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      // Unmounting synchronously inside an effect cleanup warns in React 19.
      queueMicrotask(() => root.unmount());
      host.remove();
    };
  }, [host]);

  useEffect(() => {
    const root = rootRef.current;
    if (!host || !root) return;
    let alive = true;

    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || ACCENT_FALLBACK;

    // Written by an agent editing data.json by hand, so nothing here is
    // trusted. Same guard, and same reason, as Card.tsx.
    const attributes = Array.isArray(card?.attributes) ? card.attributes : [];

    root.render(
      <>
        <style>{cardCss(accent)}</style>
        <div className="mw-plate" data-plate>
          <strong>{card?.name ?? "Untitled"}</strong>
          <p>{card?.description ?? ""}</p>
          <ul>
            {attributes.map((a) => (
              <li key={String(a)}>{String(a)}</li>
            ))}
          </ul>
        </div>
      </>,
    );

    // Two frames: one for the render to commit, one for the browser to record
    // the paint snapshot the native path needs.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (!alive) return;
        const el = host.querySelector<HTMLElement>("[data-plate]");
        if (!el) return;
        try {
          await paintElement(el, host, accent);
        } catch {
          // Both paths failed. Render nothing rather than falling back to an
          // overlay: a card that quietly stops being in the scene would teach
          // the wrong thing.
          return;
        }
        if (!alive) return;
        const next = new CanvasTexture(host);
        next.colorSpace = SRGBColorSpace;
        setTexture((prev) => {
          prev?.dispose();
          return next;
        });
        setSize([el.offsetWidth, el.offsetHeight]);
      }),
    );

    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [card, host]);

  if (!texture || !size[0]) return null;

  return (
    <mesh position={[-1.15, 1.2, 0]}>
      <planeGeometry args={[size[0] * UNITS_PER_PX, size[1] * UNITS_PER_PX]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}
