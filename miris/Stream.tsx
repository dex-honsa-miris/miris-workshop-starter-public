import { useEffect, useState } from "react";
import { MirisStream } from "@miris-inc/three";
import { FIT_OVERRIDES, MAX_DIM, PEDESTAL_TOP } from "./config";

// Fits the asset once its reported size settles.
export default function Stream({ uuid, viewerKey }: { uuid: string; viewerKey: string }) {
  const [stream] = useState(() => new (MirisStream as any)({ uuid, viewerKey }));

  useEffect(() => {
    stream.visible = false;
    let previous = 0;
    let tries = 0;

    const timer = setInterval(() => {
      let bounds: any;
      try {
        bounds = stream.getBounds();
      } catch {
        return;
      }
      const [x = 0, y = 0, z = 0] = bounds?.size ?? [];
      if (!(x > 0 && y > 0 && z > 0)) {
        if (++tries > 40) {
          clearInterval(timer);
          console.warn(`[miris] gave up waiting for bounds on ${uuid}: the stream never authorised`);
        }
        return;
      }

      const size = Math.cbrt(x * y * z);
      const settled = previous > 0 && Math.abs(size - previous) / previous < 0.03;
      previous = size;
      if (!settled && ++tries < 20) return;

      clearInterval(timer);
      const fit = FIT_OVERRIDES[uuid] ?? {};
      const scale = fit.scale ?? MAX_DIM / Math.max(x, y, z);
      const floor = fit.floor ?? bounds.min[1];
      stream.scale.setScalar(scale);
      stream.position.set(-bounds.center[0] * scale, PEDESTAL_TOP - floor * scale, -bounds.center[2] * scale);
      stream.visible = true;
      (globalThis as any).__stream = stream;
    }, 500);

    return () => clearInterval(timer);
  }, [stream, uuid]);

  return <primitive object={stream} />;
}
