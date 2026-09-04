import { useEffect, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import useHtmlTexture from "../miris/htmlTexture";
import { StageSkeleton } from "../miris/Skeleton";

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

  // miris:stops-start
  // Step 3.1 replaces this. It stays above the return because the rail reads it.
  const STOPS: Array<{ id: string; pos: [number, number, number]; look: [number, number, number] }> = [];
  // miris:stops-end

  // miris:label-start
  // Step 6.3 replaces this. It stays above the return because it calls a React
  // hook, and hooks run on every render.
  const label = useHtmlTexture(false);
  // miris:label-end

  if (!data || !data.track) return <StageSkeleton />;

  return (
    <Canvas
      linear
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.6, 4], fov: 50 }}
      style={{ position: "fixed", inset: 0 }}
    >
      {/* miris:quality-start */}
      {/* Step 2.4 goes here. */}
      {/* miris:quality-end */}

      {/* miris:room-start */}
      {/* Step 2.1 goes here. */}
      {/* miris:room-end */}

      {/* miris:materials-start */}
      {/* Step 2.2 goes here. */}
      {/* miris:materials-end */}

      {/* miris:lights-start */}
      {/* Step 2.3 goes here. */}
      {/* miris:lights-end */}

      {/* miris:rail-start */}
      {/* Step 3.2 goes here. */}
      {/* miris:rail-end */}

      {/* miris:catalog-start */}
      {/* Steps 4.2 and 4.3 go here. */}
      {/* miris:catalog-end */}

      {/* miris:card-start */}
      {/* Steps 6.2 and 6.4 go here. */}
      {/* miris:card-end */}

      <OrbitControls makeDefault target={[0, 1.2, 0]} />
    </Canvas>
  );
}
