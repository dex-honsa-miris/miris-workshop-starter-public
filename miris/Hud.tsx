import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Object3D } from "three";

/* Frame time and live splat count, drawn into a DOM node rather than the
   scene so it cannot itself cost splats. Mounted inside <Canvas> because
   useFrame and useThree need the R3F context. */

/* scene.traverse ignores .visible and walks hidden subtrees, which
   double-counts a stream that isolation or a fit has hidden. This walk stops
   at the first invisible node instead. */
function countSplats(root: Object3D): number {
  let total = 0;
  const walk = (o: any) => {
    if (!o.visible) return;
    if (o.isLod && typeof o.splatCount === "number") total += o.splatCount;
    for (const c of o.children) walk(c);
  };
  walk(root);
  return total;
}

export default function Hud() {
  const scene = useThree((s) => s.scene);
  const el = useRef<HTMLDivElement | null>(null);
  const peak = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const node = document.createElement("div");
    node.className = "mw-hud";
    document.body.appendChild(node);
    el.current = node;
    return () => {
      node.remove();
      el.current = null;
    };
  }, []);

  useFrame((_, dt) => {
    const node = el.current;
    if (!node) return;
    // Throttled to ~5Hz: at 60fps a per-frame textContent write is itself
    // measurable in the number it is trying to report.
    last.current += dt;
    if (last.current < 0.2) return;
    last.current = 0;
    const splats = countSplats(scene);
    if (splats > peak.current) peak.current = splats;
    node.textContent =
      `${(dt * 1000).toFixed(1)} ms  ·  ${splats.toLocaleString()} splats  ·  peak ${peak.current.toLocaleString()}`;
  });

  return null;
}
