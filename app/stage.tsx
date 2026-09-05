import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import {
  ACESFilmicToneMapping,
  CatmullRomCurve3,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  Vector3,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import catalog from "../miris/catalog.json";
import StageEngine, { useMirisScene, WhenEngineReady } from "../miris/engine";
import useHtmlTexture from "../miris/htmlTexture";
import { StageSkeleton } from "../miris/Skeleton";

// A Miris stream is now a scene node: <mirisStream args={[{ uuid, viewerKey }]} />
extend({ MirisStream });

// Your file. The sidebar writes between the miris: comments.
export default function Stage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);

  // miris:stops-start
  const STOPS: Array<{ id: string; pos: [number, number, number]; look: [number, number, number] }> = [
    { id: "01", pos: [-4.2, 1.5, -1.6], look: [-4.2, 1.2, -4.36] },
    { id: "02", pos: [0, 1.5, -1.6], look: [0, 1.2, -4.36] },
    { id: "03", pos: [4.2, 1.5, -1.6], look: [4.2, 1.2, -4.36] },
  ];
  // miris:stops-end

  // miris:label-start
  // Step 6.3 replaces this. It stays above the return because it calls a React
  // hook, and hooks run on every render.
  const label = useHtmlTexture(false);
  // miris:label-end

  /* The scene R3F owns is the SDK's own Scene subclass. Without this a
     <mirisStream> has no engine to subscribe through and streams nothing. */
  const scene = useMirisScene(catalog.viewerKey);

  if (!data) return <StageSkeleton />;

  return (
    <Canvas
      scene={scene}
      linear
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.6, 4], fov: 50 }}
      style={{ position: "fixed", inset: 0 }}
    >
      <StageEngine />

      {/* miris:quality-start */}
      {/* Both of these are renderer-level. A prop on <Canvas> cannot reach
          them and no amount of retuning the lights is the fix. */}
      {(() => {
        function RenderQuality() {
          const gl = useThree((state) => state.gl);
          const scene = useThree((state) => state.scene);
          const camera = useThree((state) => state.camera);

          useEffect(() => {
            // Under the default NoToneMapping the cove spots clip straight to
            // white instead of rolling off. 1.1 was tuned with a streamed piece
            // in frame: splats are unlit and read neither the environment nor
            // any light, but they do pass through this curve.
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;

            // Metal shows you what is around it, and until now nothing was:
            // brass with no environment map resolves to near-black. This is a
            // studio's worth of soft boxes, generated in a few milliseconds and
            // held low, so it lights nothing on its own.
            const pmrem = new PMREMGenerator(gl);
            const room = new RoomEnvironment();
            const environment = pmrem.fromScene(room, 0.04).texture;
            scene.environment = environment;
            scene.environmentIntensity = 0.35;
            pmrem.dispose();
            room.dispose();
            return () => {
              scene.environment = null;
              environment.dispose();
            };
          }, [gl, scene]);

          // Every frame, not once. The SDK re-derives near and far from
          // streamed bounds and had left them at 0.00035 against 35.39, a
          // 100000:1 ratio that collapses depth precision and z-fights anything
          // sitting millimetres proud of anything else. A single assignment
          // measured as being put straight back the next time bounds arrived.
          useFrame(() => {
            if (camera.near === 0.1 && camera.far === 60) return;
            camera.near = 0.1;
            camera.far = 60;
            camera.updateProjectionMatrix();
          });

          return null;
        }
        return <RenderQuality />;
      })()}
      {/* miris:quality-end */}

      {/* miris:room-start */}
      {/* useGLTF caches by URL and suspends. <Canvas> puts its children
          inside a Suspense boundary already, so nothing here needs one. */}
      {(() => {
        function Shell() {
          const room = useGLTF("/env/room.glb");
          return <primitive object={room.scene} dispose={null} />;
        }
        return <Shell />;
      })()}
      {/* miris:room-end */}

      {/* miris:materials-start */}
      {(() => {
        /* Yours. A name from room.glb on the left, what it is made of on the
           right. Keys match a mesh exactly or as a dotted prefix, so "wall"
           covers wall.north through wall.west and "shelf" covers all six.

           One rule, and it is not a taste rule: nothing transmissive. three
           renders the whole scene into a transmission buffer once per
           KHR_materials_transmission object, measured at 28.51ms of GPU against
           2.54ms without. The glass shelves below become wood for exactly that
           reason. If you want the read of glass, use polished stone or brass
           and let 01.3's environment do the reflecting. */
        const MATERIALS = {
          floor: { color: "#c9b18a", roughness: 0.62, metalness: 0 },
          ceiling: { color: "#efe9e0", roughness: 0.95, metalness: 0 },
          wall: { color: "#e6ded1", roughness: 0.92, metalness: 0 },
          rug: { color: "#b9ab97", roughness: 1, metalness: 0 },
          shelf: { color: "#b08d57", roughness: 0.26, metalness: 1 },
          glassshelf: { color: "#6b5c46", roughness: 0.38, metalness: 0 },
          trim: { color: "#b08d57", roughness: 0.3, metalness: 1 },
          crown: { color: "#b08d57", roughness: 0.3, metalness: 1 },
        };

        function Surfaces() {
          const room = useGLTF("/env/room.glb");

          useEffect(() => {
            const previous = new Map();
            const made = [];

            room.scene.traverse((node) => {
              if (!(node instanceof Mesh)) return;
              // GLTFLoader sanitises node.name into an animation-binding path
              // and strips the dots out of it, so "wall.north" arrives as
              // "wallnorth". The glTF name is stashed on userData.name, and
              // matching the sanitised one is how a rename silently does
              // nothing.
              const name = node.userData.name ?? node.name;
              const key = Object.keys(MATERIALS).find(
                (k) => name === k || name.startsWith(k + "."),
              );
              if (!key) return;

              const material = new MeshStandardMaterial(MATERIALS[key]);
              made.push(material);
              previous.set(node, node.material);
              // A mesh with several material groups gets the same one in every
              // slot, rather than losing the groups it shipped with.
              node.material = Array.isArray(node.material)
                ? node.material.map(() => material)
                : material;
            });

            return () => {
              for (const [node, material] of previous) node.material = material;
              for (const material of made) material.dispose();
            };
          }, [room]);

          return null;
        }
        return <Surfaces />;
      })()}
      {/* miris:materials-end */}

      {/* miris:props-start */}
      {(() => {
        /* Every prop is exported normalised to fit a roughly 2m cube, so the
           file's own size means nothing and the scale here is per-axis: it
           lands each one on a measured width, height and depth instead. y is
           the floor, or the top of whatever it stands on. Flush or clearly
           clear, never a millimetre above: the reference build had a rug 4mm
           off the floor and it streaked. */
        const PROPS: Array<{
          url: string;
          position: [number, number, number];
          yaw: number;
          scale: [number, number, number];
        }> = [
          { url: "/props/double-door-walnut-grand.glb", position: [6.92, 1.376, 0], yaw: -90, scale: [1.156, 1.785, 0.776] },
          { url: "/props/counter-calacatta-brass.glb", position: [-6.7, 0.526, 1.35], yaw: 90, scale: [1.051, 2.058, 1.258] },
          { url: "/props/sofa-boucle-curved.glb", position: [-0.15, 0.411, 0], yaw: 90, scale: [1.156, 1.164, 0.783] },
          { url: "/props/coffee-table-marble-sculptural.glb", position: [1.95, 0.21, 0], yaw: 18, scale: [0.578, 0.5, 0.578] },
          // One file, two nodes: the chair is downloaded once and cloned.
          { url: "/props/lounge-chair-tan-barrel.glb", position: [3.05, 0.325, -0.8], yaw: -67, scale: [0.42, 0.386, 0.423] },
          { url: "/props/lounge-chair-tan-barrel.glb", position: [3.05, 0.325, 0.8], yaw: -113, scale: [0.42, 0.386, 0.423] },
          { url: "/props/ottoman-boucle-cream.glb", position: [0.9, 0.21, 1.1], yaw: 25, scale: [0.342, 0.446, 0.342] },
          // The totem stands on the plinth, so its y is the plinth's height.
          { url: "/props/plinth-cream-stone.glb", position: [-2.4, 0.433, -3.35], yaw: 0, scale: [0.289, 1.939, 0.615] },
          { url: "/props/totem-sculpture-walnut.glb", position: [-2.4, 1.55, -3.35], yaw: 15, scale: [0.684, 0.683, 0.68] },
          { url: "/props/olive-tree-ribbed-planter.glb", position: [6.2, 1.051, -3.2], yaw: 40, scale: [0.88, 1.105, 0.928] },
          { url: "/props/olive-tree-ribbed-planter.glb", position: [-6.2, 1.051, 3.2], yaw: -70, scale: [0.88, 1.105, 0.928] },
        ];

        function Prop({ url, position, yaw, scale }: (typeof PROPS)[number]) {
          const { scene } = useGLTF(url);
          // Loaded once per URL, cloned per instance: two chairs are one
          // download and one set of geometry, two nodes in the scene.
          const object = useMemo(() => scene.clone(true), [scene]);
          return (
            <primitive
              object={object}
              position={position}
              rotation={[0, (yaw * Math.PI) / 180, 0]}
              scale={scale}
              dispose={null}
            />
          );
        }

        return PROPS.map((prop, i) => <Prop key={i} {...prop} />);
      })()}
      {/* miris:props-end */}

      {/* miris:lights-start */}
      {/* This room has no baked lightmap, so the wash pair carries it on its
          own. Our production room runs 0.22 and 0.15 only because a bake on
          TEXCOORD_1 does that job there and the pair is left for the two things
          a lightmap cannot do: feed a specular highlight, and light the trim
          and housings that sit outside the bake. */}
      <hemisphereLight args={["#fff4e6", "#4a453c", 1.1]} />
      <directionalLight color="#fff0dd" intensity={0.6} position={[3, 6, 2]} />

      {/* One cove per niche, mounted at the back of the recess near the ceiling
          and aimed DOWN the back panel rather than at it: a spot at the niche
          mouth hot-spots the panel dead on. 18 puts the panel's near-white
          fraction at about 3.5%, which is what the reference render measures;
          28 overshoots it to 5.8%, visibly more clipped without reading
          brighter. */}
      {[
        [-4.2, -4.356], [0, -4.356], [4.2, -4.356],
        [-4.2, 4.356], [0, 4.356], [4.2, 4.356],
      ].map(([x, z], i) => {
        // Out of the niche, into the room.
        const out = z < 0 ? 1 : -1;
        return (
          <spotLight
            key={i}
            color="#fff2e2"
            intensity={18}
            distance={4}
            angle={Math.PI / 2.4}
            penumbra={0.98}
            decay={1.3}
            position={[x, 2.95, z - out * 0.22]}
            ref={(light) => {
              // A spotlight aims at light.target, and light.target is not in
              // the scene graph, so nothing ever updates its world matrix for
              // you. Pin it once; nothing moves it afterwards.
              if (!light) return;
              light.target.position.set(x, 0.3, z - out * 0.15);
              light.target.updateMatrixWorld();
            }}
          />
        );
      })}
      {/* miris:lights-end */}

      {/* miris:rail-start */}
      {(() => {
        /* 04.3 is these numbers and nothing else. duration is seconds for a
           whole flight, ease shapes it, settle is how long the camera holds on
           arrival before the idle drift picks it up again. Nothing under a
           second: the flight is the window the next stop's streaming hides in,
           and a piece you land on early is still coarsening in. */
        const FLIGHT = {
          duration: 1.2,
          ease: (t) => t * t * (3 - 2 * t),
          settle: 0.4,
          idleSecondsPerLoop: 90,
        };

        // Scratch vectors: the idle drift runs every frame forever, so this is
        // the one place in the stage that would otherwise allocate steadily.
        const here = new Vector3();
        const there = new Vector3();
        const gaze = new Vector3();

        function Rail() {
          const camera = useThree((state) => state.camera);
          // R3F types state.controls as a bare EventDispatcher. What makeDefault
          // on <OrbitControls> actually put there is the controls object, and
          // its target is what the camera looks at: set the position without it
          // and OrbitControls aims you back at [0, 1.2, 0] on the next frame.
          const controls = useThree((state) => state.controls) as any;
          const run = useRef({
            i: 0,
            t: 0,
            from: 0,
            delta: 0,
            p: 1,
            hold: 0,
            idle: true,
            lookFrom: new Vector3(),
            lookTo: new Vector3(),
          });

          /* Closed, so the last stop leads back to the first, and centripetal,
             so a tight corner between two stops cannot cusp or loop back on
             itself. getPoint(i / STOPS.length) is stop i, which is what makes a
             flight a move along this curve rather than a line through the
             walls. */
          const rail = useMemo(
            () => new CatmullRomCurve3(STOPS.map((s) => new Vector3(...s.pos)), true, "centripetal"),
            [],
          );
          const looks = useMemo(() => STOPS.map((s) => new Vector3(...s.look)), []);

          const aim = (e) => {
            /* Angular, not a lerp of the look POINT. Sweeping the point through
               the room swings the gaze at a non-constant rate, fastest as it
               passes closest to the camera, and it reads as a lurch halfway
               through every flight. Yaw takes the shortest way round. */
            const s = run.current;
            here.copy(s.lookFrom).sub(camera.position);
            there.copy(s.lookTo).sub(camera.position);
            const yawFrom = Math.atan2(here.x, here.z);
            let dYaw = Math.atan2(there.x, there.z) - yawFrom;
            if (dYaw > Math.PI) dYaw -= 2 * Math.PI;
            if (dYaw < -Math.PI) dYaw += 2 * Math.PI;
            const yaw = yawFrom + dYaw * e;
            const pitchFrom = Math.atan2(here.y, Math.hypot(here.x, here.z));
            const pitchTo = Math.atan2(there.y, Math.hypot(there.x, there.z));
            const pitch = pitchFrom + (pitchTo - pitchFrom) * e;
            const reach = here.length() + (there.length() - here.length()) * e;
            gaze
              .set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
              .multiplyScalar(reach)
              .add(camera.position);
            camera.lookAt(gaze);
            if (controls) controls.target.copy(gaze);
          };

          const flyTo = (i) => {
            const s = run.current;
            const n = STOPS.length;
            s.i = ((i % n) + n) % n;
            // The short way around a closed loop, never the long way.
            let delta = (s.i / n - s.t) % 1;
            if (delta > 0.5) delta -= 1;
            if (delta < -0.5) delta += 1;
            s.from = s.t;
            s.delta = delta;
            s.p = 0;
            s.hold = 0;
            s.idle = true;
            s.lookFrom.copy(controls ? controls.target : gaze);
            s.lookTo.copy(looks[s.i]);
          };

          useEffect(() => {
            const s = run.current;
            s.lookFrom.copy(looks[0]);
            s.lookTo.copy(looks[0]);
            rail.getPoint(0, camera.position);
            aim(1);

            const onKey = (e) => {
              if (e.key === "ArrowRight") flyTo(run.current.i + 1);
              else if (e.key === "ArrowLeft") flyTo(run.current.i - 1);
            };
            // The pointer takes the camera back: a drag ends the idle drift
            // until the next flight, rather than fighting it every frame.
            const onGrab = () => { run.current.idle = false; };
            addEventListener("keydown", onKey);
            controls?.addEventListener("start", onGrab);
            return () => {
              removeEventListener("keydown", onKey);
              controls?.removeEventListener("start", onGrab);
            };
          }, [controls]);

          useFrame((_, dt) => {
            const s = run.current;
            if (s.hold > 0) {
              s.hold = Math.max(0, s.hold - dt);
              return;
            }
            if (s.p < 1) {
              s.p = Math.min(1, s.p + dt / FLIGHT.duration);
              const e = FLIGHT.ease(s.p);
              s.t = s.from + s.delta * e;
              rail.getPoint(((s.t % 1) + 1) % 1, camera.position);
              aim(e);
              if (s.p >= 1) {
                s.t = ((s.t % 1) + 1) % 1;
                s.hold = FLIGHT.settle;
              }
              return;
            }
            // The idle drift runs along the same loop the flights do, so
            // there is no glide onto it and no lurch when a flight ends.
            if (!s.idle) return;
            s.t = (s.t + dt / FLIGHT.idleSecondsPerLoop) % 1;
            rail.getPoint(s.t, camera.position);
            aim(1);
          });

          return (
            <Html fullscreen style={{ pointerEvents: "none" }}>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 28,
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 8,
                  pointerEvents: "auto",
                }}
              >
                <button className="btn btn-secondary btn-sm" onClick={() => flyTo(run.current.i - 1)}>
                  Previous stop
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => flyTo(run.current.i + 1)}>
                  Next stop
                </button>
              </div>
            </Html>
          );
        }

        // Two stops is the least a loop can be made of.
        return STOPS.length > 1 ? <Rail /> : null;
      })()}
      {/* miris:rail-end */}

      {/* miris:catalog-start */}
      {/* One stream per published piece, each measured into its own niche.
          Cache what you measure: after placement getBounds() answers about the
          placed box, so anything that needs the piece's real size later has to
          read your value rather than ask again. */}
      <WhenEngineReady>
        {catalog.inlets.map((inlet) => {
        // 1 to 3 on the north wall, 4 to 6 on the south, in room.glb's order.
        const x = [-4.2, 0, 4.2][(inlet.id - 1) % 3];
        const z = inlet.id <= 3 ? -4.356 : 4.356;
          return (
            <mirisStream
              key={inlet.uuid}
              args={[{ uuid: inlet.uuid, viewerKey: catalog.viewerKey }]}
            ref={(stream) => {
              if (!stream) return;
              /* Measured at IDENTITY: no position, no rotation and no scale
                 until the box has settled, because getBounds() after placement
                 reports the placed and scaled box rather than the clean local
                 one. Hidden meanwhile, so the pile at the origin is never
                 seen. */
              stream.visible = false;

              let loaded = false;
              let waited = 0;
              let tries = 0;
              let last = 0;
              let stable = 0;
              const onLoad = () => { loaded = true; };
              stream.addEventListener("streamloaded", onLoad);

              const timer = setInterval(() => {
                /* Two budgets, because they are two different waits. This one
                   is the network, 120s: before the asset is in, every poll
                   reads an all-zero box, and counting those against the fit
                   budget was really timing the connection, so six cold streams
                   could spend it all downloading and then be dropped as
                   empty. */
                if (!loaded) {
                  if (++waited > 240) clearInterval(timer);
                  return;
                }
                // And this one is the box settling once it is in, 40s of it.
                if (++tries > 80) {
                  clearInterval(timer);
                  return;
                }

                let box;
                try {
                  box = stream.getBounds();
                } catch {
                  return;
                }
                const [sx, sy, sz] = box?.size ?? [];
                if (!(sx > 0 && sy > 0 && sz > 0)) return;
                /* Settled means the characteristic size moved under 3% since
                   the previous poll, not that any one axis did -- and it has to
                   hold for THREE polls running. The box grows in steps as coarse
                   levels land, and it can sit still on one of them long enough
                   to look finished: measured here at 0.20m, then 0.50m a second
                   later. One stable pair is not settled, it is a plateau, and
                   fitting to it scales the piece about 2.5x too large. */
                const size = Math.cbrt(sx * sy * sz);
                if (last > 0 && Math.abs(size - last) / last < 0.03) stable++;
                else stable = 0;
                last = size;
                if (stable < 3) return;
                clearInterval(timer);

                // The niche volume from room.glb, and 0.9 so nothing touches
                // the sides of its own niche.
                const fit = Math.min(1.2 / sx, 0.9 / sy, 0.55 / sz) * 0.9;
                const facing = z < 0 ? 1 : -1;
                stream.scale.setScalar(fit);
                stream.rotation.set(0, z < 0 ? 0 : Math.PI, 0);
                // Bottom-centre: x and z centred in the volume, the local
                // minimum y resting on the shelf floor at 1.2.
                stream.position.set(
                  x - facing * box.center[0] * fit,
                  1.2 - box.min[1] * fit + 0.01,
                  z - facing * box.center[2] * fit,
                );
                stream.visible = true;
              }, 500);

              return () => {
                stream.removeEventListener("streamloaded", onLoad);
                clearInterval(timer);
              };
            }}
            />
          );
        })}
      </WhenEngineReady>
      {/* miris:catalog-end */}

      {/* miris:card-start */}
      {/* Steps 6.2 and 6.4 go here. */}
      {/* miris:card-end */}

      <OrbitControls makeDefault target={[0, 1.2, 0]} />
    </Canvas>
  );
}
