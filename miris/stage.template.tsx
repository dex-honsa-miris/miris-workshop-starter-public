import { useEffect, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { ACESFilmicToneMapping } from "three";
import Card from "../miris/Card";
import CardSurface from "../miris/CardSurface";
import { DEMO_UUID, VIEWER_KEY } from "../miris/config";

// A Miris stream is now a scene node: <mirisStream args={[{ uuid, viewerKey }]} />
extend({ MirisStream });

// Your file. The sidebar writes between the miris: comments.
export default function Stage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);

  if (!data || !data.track) return null;

  return (
    <Canvas
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
      {/* miris:scene-start */}
      {/* miris:scene-end */}
      {/* miris:card-start */}
      {/* miris:card-end */}
      <OrbitControls makeDefault target={[0, 0.9, 0]} />
    </Canvas>
  );
}
