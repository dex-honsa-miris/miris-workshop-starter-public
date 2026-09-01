import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import Card from "../miris/Card";
import Frame from "../miris/Frame";
import Stream from "../miris/Stream";
import { bootEngine } from "../miris/engine";
import { DEMO_UUID, VIEWER_KEY } from "../miris/config";

// Your file. The sidebar writes between the miris: comments.
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
