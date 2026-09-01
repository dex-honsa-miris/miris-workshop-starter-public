import { createRoot } from "react-dom/client";
import Stage from "./stage";
import MirisGuide from "../miris/Guide";
import StageBoundary from "../miris/StageBoundary";

createRoot(document.getElementById("root")!).render(
  <>
    <StageBoundary>
      <Stage />
    </StageBoundary>
    <MirisGuide />
  </>,
);
