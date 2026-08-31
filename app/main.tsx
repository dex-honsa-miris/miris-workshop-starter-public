import { createRoot } from "react-dom/client";
import Stage from "./stage";
import StageBoundary from "./StageBoundary";
import MirisGuide from "../miris/Guide";

/* The whole app. Stage is what you edit for the next two hours; MirisGuide is
 * the panel walking you through it.
 *
 * Stage sits inside a boundary because you are about to edit it live and a
 * syntax error should not take the guide down with it. */
createRoot(document.getElementById("root")!).render(
  <>
    <StageBoundary>
      <Stage />
    </StageBoundary>
    <MirisGuide />
  </>,
);
