import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { MirisScene, MirisStream } from "@miris-inc/three";
import { ACESFilmicToneMapping } from "three";
import Card from "../miris/Card";
import { DEMO_UUID, FIT_OVERRIDES, MAX_DIM, PEDESTAL_TOP, VIEWER_KEY } from "../miris/config";

// Booted once per page load, never disposed, and deliberately so.
//
// Every Fill rewrites this file, so Fast Refresh remounts Stage, and React runs
// effects twice in development anyway. Constructing a scene per mount left
// engine-registered scenes behind, still streaming. Disposing them in the effect
// cleanup is worse: it runs while R3F still holds the children and the stream is
// mid-update, and the engine fails three assertions (Scene.cpp:27 and :141,
// AquaApi.cpp:374). Reusing one engine avoids both.
let engine: Promise<{ scene: any; backend: any }> | null = null;

function bootEngine(viewerKey: string) {
  engine ??= (async () => {
    const scene = new (MirisScene as any)({ viewerKey });
    await scene.ready;
    const backend = scene.miris.backend ?? (await scene.miris.initializeBackend());
    (globalThis as any).__scene = scene;
    return { scene, backend };
  })();
  return engine;
}

function Frame({ backend }: { backend: any }) {
  useFrame(({ gl, scene, camera }) => {
    (globalThis as any).__camera = camera;
    (scene as any).miris?.update?.();
    backend.doRendering(gl, scene, camera);
  }, 1);
  return null;
}

function Stream({ uuid, viewerKey }: { uuid: string; viewerKey: string }) {
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
        // Bounds never arriving means the stream never authorised. Give up
        // loudly rather than polling in silence forever.
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

export default function Stage() {
  const [data, setData] = useState<any>(null);
  const [boot, setBoot] = useState<{ scene: any; backend: any } | null>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);

  useEffect(() => {
    if (!data || !data.track) return;
    let dead = false;
    bootEngine(data.viewerKey || VIEWER_KEY).then((ready) => {
      if (!dead) setBoot(ready);
    });
    return () => {
      dead = true;
    };
  }, [data]);

  if (!data || !data.track || !boot) return null;

  return (
    <Canvas
      scene={boot.scene}
      linear
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{ position: [0, 1.5, 3.4], fov: 40 }}
      style={{ position: "fixed", inset: 0 }}
    >
      <hemisphereLight args={[0xffffff, 0x223044, 2.2]} />
      {/* miris:frame-start */}
      {/* miris:frame-end */}
      {/* miris:scene-start */}
      {/* miris:scene-end */}
      {/* miris:card-start */}
      {/* miris:card-end */}
      <OrbitControls makeDefault target={[0, 0.9, 0]} />
    </Canvas>
  );
}
