import { useEffect, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { Billboard, Environment, OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { ACESFilmicToneMapping } from "three";
import Card from "../miris/Card";
import useHtmlTexture from "../miris/htmlTexture";

// A Miris stream is now a scene node: <mirisStream args={[{ uuid, viewerKey }]} />
extend({ MirisStream });

// Your file. Each step's code goes between the miris: comments below.
export default function Stage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);

  // miris:label-start
  // Step 5.3 replaces this placeholder. It stays above the return because it
  // calls a React hook, and hooks run on every render.
  const label = useHtmlTexture(false);
  // miris:label-end

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
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 0.5, 48]} />
        <meshStandardMaterial color={0x111215} roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.015, 12, 64]} />
        <meshBasicMaterial color={0xe8e9ed} />
      </mesh>
      <Environment files="/env/white-chapel.hdr" environmentIntensity={1.6} />
      {/* miris:scene-end */}

      {/* miris:card-start */}
      {/* Steps 5.2 and 5.4 go here. */}
      {/* miris:card-end */}

      <OrbitControls makeDefault target={[0, 0.9, 0]} />
    </Canvas>
  );
}
