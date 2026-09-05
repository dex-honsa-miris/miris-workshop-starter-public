import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import {
  ACESFilmicToneMapping,
  CatmullRomCurve3,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import catalog from "../miris/catalog.json";
import StageEngine, { useMirisScene, WhenEngineReady } from "../miris/engine";
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
  // Step 04.1 goes here: one entry per thing worth seeing. The block sits
  // above the return in plain // comments because this is JavaScript scope,
  // not JSX, and 04.2's rail needs more than one stop before it will fly.
  const STOPS: Array<{ id: string; pos: [number, number, number]; look: [number, number, number] }> = [];
  // miris:stops-end

  // miris:label-start
  // Step 6.3 replaces this. It stays above the return because it calls a React
  // hook, and hooks run on every render.
  const label = useHtmlTexture(false);
  // miris:label-end

  /* The scene R3F owns is the SDK's own Scene subclass. Without this a
     <mirisStream> has no engine to subscribe through and streams nothing. */
  const scene = useMirisScene(catalog.viewerKey);

  if (!data) return <StageSkeleton />;

  return (
    <Canvas
      scene={scene}
      linear
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.6, 4], fov: 50 }}
      style={{ position: "fixed", inset: 0 }}
    >
      <StageEngine />

      {/* miris:quality-start */}
      {/* Step 01.3 goes here. */}
      {/* miris:quality-end */}

      {/* miris:room-start */}
      {/* Step 01.1 goes here. */}
      {/* miris:room-end */}

      {/* miris:materials-start */}
      {/* Step 02.1 goes here. */}
      {/* miris:materials-end */}

      {/* miris:props-start */}
      {/* Step 03.1 goes here. */}
      {/* miris:props-end */}

      {/* miris:lights-start */}
      {/* Step 01.2 goes here. */}
      {/* miris:lights-end */}

      {/* miris:rail-start */}
      {/* Step 04.2 goes here. Step 04.3 tunes the numbers in it. */}
      {/* miris:rail-end */}

      {/* miris:catalog-start */}
      {/* Steps 05.2 and 05.3 go here. */}
      {/* miris:catalog-end */}

      {/* miris:card-start */}
      {/* Steps 06.2 and 06.4 go here. */}
      {/* miris:card-end */}

      <OrbitControls makeDefault target={[0, 1.2, 0]} />
    </Canvas>
  );
}
