import { useEffect, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MirisScene, MirisStream } from "@miris-inc/three";

/* What makes a <mirisStream> actually stream.
 *
 * MirisScene extends three's Scene, so the SDK does not decorate your scene,
 * it IS your scene. A <mirisStream> dropped into an ordinary R3F canvas has no
 * engine to subscribe through, so it asks the network for nothing at all and
 * an empty niche looks exactly like a slow one. That failure is silent: no
 * throw, no console error, wasm still loads.
 *
 * Two halves fix it. `mirisScene()` builds the scene R3F should own, handed to
 * <Canvas scene={...}>. <StageEngine /> then boots the backend and takes the
 * frame: any useFrame with priority >= 1 stops R3F rendering by itself, which
 * is what lets doRendering draw the ordinary three content and the splat
 * composite in one pass. Calling gl.render alongside it would draw twice. */

export function mirisScene(viewerKey: string) {
  const scene = new MirisScene({ viewerKey });
  /* Belt and braces. The constructor takes the key, and the SDK also exposes
     setViewerKey plus a static default on MirisStream. A stream with no key
     authorises nothing and asks the network for nothing, silently, so the key
     is set every way the published surface allows. */
  if (viewerKey) {
    scene.setViewerKey(viewerKey);
    (MirisStream as unknown as { viewerKey: string }).viewerKey = viewerKey;
  }
  return scene;
}

/** Same scene for the life of the tab. A second MirisScene means a second
 *  engine, and both would composite. */
export function useMirisScene(viewerKey: string) {
  return useMemo(() => mirisScene(viewerKey), [viewerKey]);
}

export default function StageEngine() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const [backend, setBackend] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = scene as unknown as MirisScene;
      if (!ms?.ready) return;
      await ms.ready;
      const miris: any = ms.miris;
      const b = miris.backend ?? (await miris.initializeBackend());
      if (alive) setBackend(b);
    })();
    return () => {
      alive = false;
    };
  }, [scene]);

  useFrame(() => {
    /* The SDK re-derives near and far from streamed bounds every time it
       looks, and a single assignment is put straight back: measured at
       0.00035 against 35.39, a 100000:1 ratio that z-fights anything a few
       millimetres proud of a surface. So this is re-pinned per frame, not
       once. */
    const cam = camera as any;
    if (cam.near !== 0.1 || cam.far !== 60) {
      cam.near = 0.1;
      cam.far = 60;
      cam.updateProjectionMatrix();
    }
    if (backend) backend.doRendering(gl, scene, camera);
    else gl.render(scene, camera);
  }, 1);

  return null;
}
