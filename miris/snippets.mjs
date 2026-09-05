/* The four maps must stay key-for-key identical: a fill id present in three of
   them and absent from PARTS crashes the sidebar. miris/integrity.mjs checks
   that at boot, against the curriculum and against both stage files.

   SNIPPETS is what Fill writes. PARTS is what the card shows. They differ
   wherever two steps share a marker, because the later snippet then contains
   the earlier one and showing an attendee the whole thing would show them the
   code they already have.

   CLEARS_TO steps back one: a marker-wide clear returns to the step before it,
   or null if there is nothing before it (the block returns to the template's
   blank).

   Indentation is load-bearing. Everything inside the returned JSX carries six
   columns; the two //-comment markers (stops, label) sit in the function body
   and carry two. Step.tsx dedents for the 408px panel, so the file keeps the
   columns and the card does not have to.

   Why so many of these open with an IIFE. A marker inside the returned JSX is
   a JSX children position, which holds expressions and not statements, and
   these blocks need statements: a MATERIALS record to edit, a curve to build
   once, and above all a child component. Hooks cannot go in Stage's own body
   here, because `if (!data) return <StageSkeleton />` runs above the return and
   a hook added after it changes Stage's hook count between the first render and
   the second. Inside a child component they are fine, and useThree/useFrame
   need to be inside <Canvas> anyway. Stage renders two or three times, all of
   them at boot, so the component identity these IIFEs hand back is stable for
   the whole session after that. */

/* ── 01 the room ─────────────────────────────────────── */

const ROOM = `      {/* useGLTF caches by URL and suspends. <Canvas> puts its children
          inside a Suspense boundary already, so nothing here needs one. */}
      {(() => {
        function Shell() {
          const room = useGLTF("/env/room.glb");
          return <primitive object={room.scene} dispose={null} />;
        }
        return <Shell />;
      })()}`;

const LIGHTS = `      {/* This room has no baked lightmap, so the wash pair carries it on its
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
      })}`;

const QUALITY = `      {/* Both of these are renderer-level. A prop on <Canvas> cannot reach
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
      })()}`;

/* ── 02 surfaces ─────────────────────────────────────── */

const MATERIALS = `      {(() => {
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
      })()}`;

/* ── 03 furniture ────────────────────────────────────── */

const PROPS = `      {(() => {
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
      })()}`;

/* ── 04 the tour ─────────────────────────────────────── */

const RAIL = `      {(() => {
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
      })()}`;

/* ── 05 the collection ───────────────────────────────── */

/* Both catalog blocks derive the niche from the entry's own id rather than
   carrying a second table that could drift out of step with room.glb: 1 to 3
   are the north wall, 4 to 6 the south, at the three x the shelves sit at. */
const NICHE_OF = `        // 1 to 3 on the north wall, 4 to 6 on the south, in room.glb's order.
        const x = [-4.2, 0, 4.2][(inlet.id - 1) % 3];
        const z = inlet.id <= 3 ? -4.356 : 4.356;`;

const CATALOG = `      {/* One stream per published piece, mounted on its niche anchor. They
          arrive at whatever size they were captured at, which is exactly the
          problem 05.3 measures away -- expect them to overflow the niche. */}
      {catalog.inlets.map((inlet) => {
${NICHE_OF}
        return (
          <mirisStream
            key={inlet.uuid}
            args={[{ uuid: inlet.uuid, viewerKey: catalog.viewerKey }]}
            position={[x, 1.2, z]}
            rotation={[0, z < 0 ? 0 : Math.PI, 0]}
          />
        );
      })}`;

const FIT_REF = `            ref={(stream) => {
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
            }}`;

const CATALOG_FIT = `      {/* One stream per published piece, each measured into its own niche.
          Cache what you measure: after placement getBounds() answers about the
          placed box, so anything that needs the piece's real size later has to
          read your value rather than ask again. */}
      {catalog.inlets.map((inlet) => {
${NICHE_OF}
        return (
          <mirisStream
            key={inlet.uuid}
            args={[{ uuid: inlet.uuid, viewerKey: catalog.viewerKey }]}
${FIT_REF}
          />
        );
      })}`;

/* ── 06 the placards ─────────────────────────────────── */

const CARD_OVERLAY = `      {/* drei's Html projects a scene position into screen space every frame
          and moves a real DOM element to match. Watch what it cannot do: the
          card is OVER the canvas rather than in it, so nothing in the scene can
          pass in front of it, it takes no tone mapping, and it is missing from
          any screenshot of the canvas. */}
      {catalog.inlets.map((inlet) => {
        // The placard anchors from room.glb, beside each niche.
        const x = [-3.15, 1.05, 5.25][(inlet.id - 1) % 3];
        const z = inlet.id <= 3 ? -3.98 : 3.98;
        return (
          <Html key={inlet.uuid} position={[x, 1.35, z]} center>
            <div className="mw-plate">
              <strong>{inlet.name}</strong>
              <p>{inlet.tagline}</p>
              <ul>
                {inlet.attributes.map((a) => (
                  <li key={a.label}>
                    {a.label}: {a.value}
                  </li>
                ))}
                <li>{inlet.price}</li>
              </ul>
            </div>
          </Html>
        );
      })}`;

const LABEL_HTML = `  // Painted by ctx.drawElementImage() where the browser has HTML-in-Canvas, an
  // SVG foreignObject serialisation everywhere else. Both paths end as pixels in
  // a 2D canvas, and a CanvasTexture samples it from there. Anything HTML can
  // lay out, the scene can wear.
  const placard = data?.pieces?.find((piece) => piece.card)?.card;
  const label = useHtmlTexture(
    placard &&
      \`<div class="mw-plate">
        <strong>\${placard.name}</strong>
        <p>\${placard.description}</p>
        <ul>\${placard.attributes.map((a) => \`<li>\${a}</li>\`).join("")}</ul>
      </div>\`,
  );`;

const LABEL_MESH = `      {/* The same markup, now geometry. Billboard turns the plane to the camera
          every frame, and without it a plane is invisible edge-on and gone
          entirely from behind, because single-sided geometry culls its back
          face. transparent honours the rounded corners, toneMapped={false}
          keeps the text out of the ACES curve from 01.3, and the width and
          height come back from the hook already in scene units. */}
      {label.texture && (
        <Billboard position={[-3.15, 1.35, -3.9]}>
          <mesh>
            <planeGeometry args={[label.width, label.height]} />
            <meshBasicMaterial map={label.texture} transparent toneMapped={false} />
          </mesh>
        </Billboard>
      )}
`.trimEnd();

/* ── the maps ────────────────────────────────────────── */

export const SNIPPETS = {
  room: ROOM,
  lights: LIGHTS,
  quality: QUALITY,
  materials: MATERIALS,
  props: PROPS,
  rail: RAIL,
  catalog: CATALOG,
  // Shares the catalog marker, so it contains the mount as well as the fit.
  catalogFit: CATALOG_FIT,
  cardOverlay: CARD_OVERLAY,
  labelHtml: LABEL_HTML,
  // Shares the card marker deliberately, so the plane REPLACES 06.2's overlay
  // rather than standing a second placard beside it. That swap is the step.
  labelMesh: LABEL_MESH,
};

/* What each step actually adds, for the card. Identical to SNIPPETS everywhere
   a step owns its marker outright; the one place it is not is catalogFit, where
   the snippet carries 05.2's mount too and the card should only show the fit. */
export const PARTS = {
  room: ROOM,
  lights: LIGHTS,
  quality: QUALITY,
  materials: MATERIALS,
  props: PROPS,
  rail: RAIL,
  catalog: CATALOG,
  catalogFit: FIT_REF,
  cardOverlay: CARD_OVERLAY,
  labelHtml: LABEL_HTML,
  labelMesh: LABEL_MESH,
};

/* Clearing a step puts the block back to the step before it, not to empty. Two
   markers carry two steps each, and a marker-wide clear at the second one would
   otherwise take the first one's work with it. null means there is nothing
   before it and the block returns to the template's blank. */
export const CLEARS_TO = {
  room: null,
  lights: null,
  quality: null,
  materials: null,
  props: null,
  rail: null,
  catalog: null,
  catalogFit: "catalog",
  cardOverlay: null,
  labelHtml: null,
  labelMesh: "cardOverlay",
};

export const MARKER_FOR = {
  room: "room",
  lights: "lights",
  quality: "quality",
  materials: "materials",
  props: "props",
  rail: "rail",
  catalog: "catalog",
  catalogFit: "catalog",
  cardOverlay: "card",
  labelHtml: "label",
  labelMesh: "card",
};
