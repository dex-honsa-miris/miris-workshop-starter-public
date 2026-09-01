import { useFrame } from "@react-three/fiber";

// priority 1 turns off R3F's own render and hands the frame to the engine.
export default function Frame({ backend }: { backend: any }) {
  useFrame(({ gl, scene, camera }) => {
    (globalThis as any).__camera = camera;
    (scene as any).miris?.update?.();
    backend.doRendering(gl, scene, camera);
  }, 1);
  return null;
}
