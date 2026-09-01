import { createRoot } from "react-dom/client";
import Stage from "./stage";
import StageBoundary from "./StageBoundary";
import MirisGuide from "../miris/Guide";

createRoot(document.getElementById("root")!).render(
  <>
    <StageBoundary>
      <Stage />
    </StageBoundary>
    <MirisGuide />
  </>,
);
