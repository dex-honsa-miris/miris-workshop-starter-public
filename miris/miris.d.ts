import type { MirisStream } from "@miris-inc/three";
import type { ThreeElement } from "@react-three/fiber";

// Types the <mirisStream> tag. extend() is what actually registers it, in app/stage.tsx.
declare module "@react-three/fiber" {
  interface ThreeElements {
    mirisStream: ThreeElement<typeof MirisStream>;
  }
}
