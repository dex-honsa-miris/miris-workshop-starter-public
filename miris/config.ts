export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

export const PEDESTAL_TOP = 0.5;
export const MAX_DIM = 1.6;

export const IMAGE_MODEL = "fal-ai/flux/schnell";
export const MODEL_3D = "meshy/v7/image-to-3d";
export const CONSOLE_URL = "https://app.miris.com";
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";

// Authorises every stream. Cold start is 6 to 9s; warming it early does not help.
export const JWKS_URL = "https://app.miris.com/.well-known/jwks.json";

// Reported bounds are the octree cell, not the content, so scale and floor are
// measured per asset. Version-specific: taken on @miris-inc/three 0.0.8-1238406.
export const FIT_OVERRIDES: Record<string, { scale?: number; floor?: number }> = {
  [DEMO_UUID]: { floor: -1.017 },
};
