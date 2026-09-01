import { MirisScene } from "@miris-inc/three";

/* Booted once per page load, never disposed, and deliberately so.
 *
 * Every Fill rewrites app/stage.tsx, so Fast Refresh remounts Stage, and React
 * runs effects twice in development anyway. Constructing a scene per mount left
 * engine-registered scenes behind, still streaming. Disposing them in the effect
 * cleanup is worse: it runs while R3F still holds the children and the stream is
 * mid-update, and the engine fails three assertions (Scene.cpp:27 and :141,
 * AquaApi.cpp:374). Reusing one engine avoids both.
 *
 * Held on globalThis, not in a module variable. Fast Refresh re-evaluates this
 * module on every edit, which resets a module-level variable and defeats the
 * memo, so each edit built a second MirisScene and left the first one registered
 * with the engine, still streaming. globalThis survives the re-evaluation, so the
 * boot really does happen once per page load. */
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
