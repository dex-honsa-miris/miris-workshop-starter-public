import { useFrame } from "@react-three/fiber";

/* Hands the frame to the Miris engine. R3F normally draws every frame; here it
 * must not, because the engine's doRendering draws both the ordinary three.js
 * content and the streamed splats. A useFrame priority of 1 switches R3F's
 * automatic render off and hands the job over. Step 2.3 explains this. */
export default function Frame({ backend }: { backend: any }) {
  useFrame(({ gl, scene, camera }) => {
    (globalThis as any).__camera = camera;
    (scene as any).miris?.update?.();
    backend.doRendering(gl, scene, camera);
  }, 1);
  return null;
}
