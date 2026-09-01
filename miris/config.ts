export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

export const PEDESTAL_TOP = 0.5;
export const MAX_DIM = 1.6;

export const IMAGE_MODEL = "fal-ai/flux/schnell";
export const MODEL_3D = "meshy/v7/image-to-3d";
export const CONSOLE_URL = "https://app.miris.com";
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";

// The engine authorises every stream against this. Measured cold at 6 to 9s,
// then 0.3s once warm, and the engine's own fetch gives up during a cold start.
// Warming it from the page does NOT help: the response carries no cache-control,
// so nothing is cached and the wait is just paid twice. Left here as a pointer
// for whoever chases the latency.
export const JWKS_URL = "https://app.miris.com/.well-known/jwks.json";

// The SDK's reported bounds are the octree root cell, not the visible content:
// for the demo asset it reads as a uniform 11.59 cube whatever is inside it.
// So a box-derived scale makes everything small, and the box floor is not where
// the content starts. Per-asset overrides, measured on screen.
//
// Measured 2026-08-28 against @miris-inc/three 0.0.8-1238406. Both numbers are
// version-specific: on 0.0.8-dc2d7ec the same asset measured floor -1.24.
export const FIT_OVERRIDES: Record<string, { scale?: number; floor?: number }> = {
  [DEMO_UUID]: { floor: -1.017 },
};
