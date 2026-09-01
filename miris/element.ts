import { MirisStream } from "@miris-inc/three";
import { extend, type ThreeElement } from "@react-three/fiber";

// Makes <mirisStream> a JSX element, so a stream is just another scene node.
declare module "@react-three/fiber" {
  interface ThreeElements {
    mirisStream: ThreeElement<typeof MirisStream>;
  }
}

extend({ MirisStream });
