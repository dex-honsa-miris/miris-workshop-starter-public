import { useEffect, useState } from "react";
import { CanvasTexture, LinearSRGBColorSpace } from "three";
import { detect, paintElement } from "./htmlInCanvas";

/** Scene units per CSS pixel: a 200px card comes out 0.9 units wide, which is
 *  the width the old drei overlay read as at the same position. */
const UNITS_PER_PX = 0.0045;

/** Fallback for --accent, which resolves from :root in guide.css. */
const ACCENT_FALLBACK = "#35ddfe";

export interface HtmlTexture {
  /** Null until the first paint lands, and while `html` is empty. */
  texture: CanvasTexture | null;
  /** Plane size in scene units, already converted. */
  width: number;
  height: number;
}

const EMPTY: HtmlTexture = { texture: null, width: 0, height: 0 };

/** Your markup, painted into a canvas, handed back as a three.js texture.
 *
 *  The markup is rendered offscreen, laid out for real, then drawn:
 *  ctx.drawElementImage() where the browser has HTML-in-Canvas, an SVG
 *  foreignObject serialisation everywhere else. Both paths end as pixels in
 *  the same 2D canvas, and a CanvasTexture samples it from there. Pass a
 *  falsy value to render nothing.
 */
export default function useHtmlTexture(html: string | false | null | undefined): HtmlTexture {
  const [out, setOut] = useState<HtmlTexture>(EMPTY);

  useEffect(() => {
    if (!html) {
      setOut((prev) => {
        prev.texture?.dispose();
        return EMPTY;
      });
      return;
    }

    let alive = true;
    let made: CanvasTexture | null = null;

    // Offscreen via `left`, never display:none: an unrendered element never
    // paints, and the native call throws without a paint snapshot. The native
    // path also requires the element to live INSIDE the canvas it draws onto,
    // with layoutsubtree; the fallback lays out in a plain div and paints into
    // a canvas of its own.
    const offscreen = "position:fixed;left:-10000px;top:0;pointer-events:none";
    let host: HTMLElement;
    let target: HTMLCanvasElement;
    if (detect().path === "drawElement") {
      const c = document.createElement("canvas");
      c.setAttribute("layoutsubtree", "");
      c.style.cssText = offscreen;
      host = c;
      target = c;
    } else {
      host = document.createElement("div");
      host.style.cssText = offscreen;
      target = document.createElement("canvas");
    }
    host.innerHTML = html;
    document.body.appendChild(host);

    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      ACCENT_FALLBACK;

    // Two frames: one for layout, one for the paint snapshot the native path
    // needs to exist before it can be drawn from.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (!alive) return;
        const el = host.firstElementChild as HTMLElement | null;
        if (!el) return;
        try {
          await paintElement(el, target, accent);
        } catch {
          // Neither path could draw. Stay empty rather than showing a broken
          // texture; the step's badge says which path was attempted.
          return;
        }
        if (!alive) return;
        const texture = new CanvasTexture(target);
        // Deliberate pass-through, not a mistake to "correct" to sRGB: the
        // stage's <Canvas linear> means nothing re-encodes after sampling, so
        // tagging this sRGB would decode it once and leave the text washed out.
        texture.colorSpace = LinearSRGBColorSpace;
        made = texture;
        setOut((prev) => {
          prev.texture?.dispose();
          return {
            texture,
            width: el.offsetWidth * UNITS_PER_PX,
            height: el.offsetHeight * UNITS_PER_PX,
          };
        });
      }),
    );

    return () => {
      alive = false;
      cancelAnimationFrame(id);
      made?.dispose();
      host.remove();
    };
  }, [html]);

  return out;
}
