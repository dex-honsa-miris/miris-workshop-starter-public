import { MirisScene } from "@miris-inc/three";

// One scene per page load. On globalThis so Fast Refresh cannot build a second.
declare global {
  var __mirisEngine: Promise<{ scene: any; backend: any }> | undefined;
}

export function bootEngine(viewerKey: string) {
  globalThis.__mirisEngine ??= (async () => {
    const scene = new (MirisScene as any)({ viewerKey });
    await scene.ready;
    const backend = scene.miris.backend ?? (await scene.miris.initializeBackend());
    (globalThis as any).__scene = scene;
    return { scene, backend };
  })();
  return globalThis.__mirisEngine;
}
