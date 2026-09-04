import { createRoot } from "react-dom/client";
import Stage from "./stage";
import MirisGuide from "../miris/Guide";
import StageBoundary from "../miris/StageBoundary";
import { MIRIS_SERVER } from "../miris/config";

/* Before anything renders, because the SDK reads this once on its first
   request and defaults to dev.miris.com. The viewer key in miris/catalog.json
   authorises app.miris.com, so leaving it unset 404s every stream, silently:
   the engine still loads its wasm and the niches just stay empty. */
(globalThis as Record<string, unknown>).MIRIS_SERVER_BASE_URL = MIRIS_SERVER;

createRoot(document.getElementById("root")!).render(
  <>
    <StageBoundary>
      <Stage />
    </StageBoundary>
    <MirisGuide />
  </>,
);
