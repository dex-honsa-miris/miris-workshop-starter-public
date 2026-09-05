import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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
  /* Constructor only. Adding setViewerKey and the MirisStream.viewerKey static
     looked like belt and braces and was the one thing the working path did not
     do: a scene built with the plain constructor loaded a stream in seconds,
     while the same scene with the key also pushed through those two setters
     never fired streamloaded. Each stream carries its own key anyway. */
  return new MirisScene({ viewerKey });
}


/** Same scene for the life of the tab. A second MirisScene means a second
 *  engine, and both would composite. */
/* Built at module scope, not inside render. A scene constructed during a React
   commit never loaded a stream here, while one built by hand in the same page
   loaded within seconds. Module scope is the closest thing to the reference's
   plain async boot, and it also guarantees exactly one engine for the tab. */
let singleton: MirisScene | null = null;

export function useMirisScene(viewerKey: string) {
  if (!singleton) singleton = mirisScene(viewerKey);
  (globalThis as any).__app = singleton;
  return singleton;
}

/* Streams must not mount before the backend exists. The reference calls
   mountStreams only after createStage has awaited scene.ready and
   initializeBackend, and a MirisStream constructed before there is an engine
   to subscribe through never retries: it sits in the graph, fully formed, with
   children, asking the network for nothing. That is the whole reason six
   streams rendered nothing while every other signal looked healthy. */
let engineReady = false;
const readyListeners = new Set<() => void>();
const markReady = () => {
  if (engineReady) return;
  engineReady = true;
  readyListeners.forEach((l) => l());
};

export function useMirisReady() {
  return useSyncExternalStore(
    (cb) => {
      readyListeners.add(cb);
      return () => {
        readyListeners.delete(cb);
      };
    },
    () => engineReady,
    () => false,
  );
}

/** Holds its children back until the backend exists.
 *
 *  A MirisStream constructed before there is a backend does not wait for one:
 *  it initialises a spork renderer of its own. Six streams mounting in the same
 *  commit as StageEngine therefore stand up SIX renderers -- the console says
 *  "initializing spork renderer" six times, where the working reference says it
 *  once -- and doRendering draws through the single backend StageEngine holds
 *  while the streams composite into the five nobody draws. They load, they
 *  refine to a million splats, and none of it reaches the canvas. */
export function WhenEngineReady({ children }: { children: ReactNode }) {
  return useMirisReady() ? <>{children}</> : null;
}

export default function StageEngine() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const [engine, setEngine] = useState<{ miris: any; backend: any } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ms = scene as unknown as MirisScene;
      if (!ms?.ready) return;
      await ms.ready;
      const miris: any = ms.miris;
      const b = miris.backend ?? (await miris.initializeBackend());
      if (!alive) return;
      setEngine({ miris, backend: b });
      markReady();
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
    if (!engine) {
      gl.render(scene, camera);
      return;
    }
    /* Both calls, in this order. update() is the core tick that advances
       streaming, fades and ordering: without it a stream mounts, reports
       children and never progresses, which looks exactly like a stream that
       was never authorised. doRendering then draws the ordinary three content
       and the splat composite in one pass, which is why gl.render must not be
       called alongside it. */
    engine.miris.update?.();
    engine.backend.doRendering(gl, scene, camera);
  }, 1);

  return null;
}
