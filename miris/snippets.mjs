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

const LIGHTS = `      {(() => {
        /* THEME once more, and it has to match 02's and 03's. The room has no
           baked lightmap, so the wash pair carries it on its own. Our
           production room runs 0.22 and 0.15 only because a bake on TEXCOORD_1
           does that job there and the pair is left for the two things a
           lightmap cannot do: feed a specular highlight, and light the trim and
           housings that sit outside the bake.

           The vault is not simply the boutique turned down. Its wash is COOLER
           and its ground bounce is nearly black, so the dark panels stay dark
           instead of going muddy grey -- and its cove is slightly hotter and
           whiter, because the whole point of the room is that the niches are
           the only warm-bright thing in it. Turn the wash down instead and you
           get a dim room rather than a vault. */
        const THEME = "vault"; // "vault" | "boutique"

        const LIGHTING = {
          boutique: {
            sky: "#fff4e6", ground: "#4a453c", wash: 1.1,
            sun: "#fff0dd", sunIntensity: 0.6,
            cove: "#fff2e2", coveIntensity: 18,
          },
          vault: {
            sky: "#c3d6ea", ground: "#0e1216", wash: 0.95,
            sun: "#d6e6f7", sunIntensity: 0.5,
            cove: "#eaf4ff", coveIntensity: 22,
          },
        }[THEME];

        return (
          <>
            <hemisphereLight args={[LIGHTING.sky, LIGHTING.ground, LIGHTING.wash]} />
            <directionalLight color={LIGHTING.sun} intensity={LIGHTING.sunIntensity} position={[3, 6, 2]} />

            {/* One cove per niche, mounted at the back of the recess near the
                ceiling and aimed DOWN the back panel rather than at it: a spot
                at the niche mouth hot-spots the panel dead on. 18 puts the
                panel's near-white fraction at about 3.5%, which is what the
                reference render measures; 28 overshoots it to 5.8%, visibly
                more clipped without reading brighter. */}
            {[
              [-4.2, -4.356], [0, -4.356], [4.2, -4.356],
              [-4.2, 4.356], [0, 4.356], [4.2, 4.356],
            ].map(([x, z], i) => {
              // Out of the niche, into the room.
              const out = z < 0 ? 1 : -1;
              return (
                <spotLight
                  key={i}
                  color={LIGHTING.cove}
                  intensity={LIGHTING.coveIntensity}
                  distance={4}
                  angle={Math.PI / 2.4}
                  penumbra={0.98}
                  decay={1.3}
                  position={[x, 2.95, z - out * 0.22]}
                  ref={(light) => {
                    // A spotlight aims at light.target, and light.target is not
                    // in the scene graph, so nothing ever updates its world
                    // matrix for you. Pin it once; nothing moves it afterwards.
                    if (!light) return;
                    light.target.position.set(x, 0.3, z - out * 0.15);
                    light.target.updateMatrixWorld();
                  }}
                />
              );
            })}
          </>
        );
      })()}`;

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

           Two palettes, one word. THEME picks which table is used AND which
           folder the maps come from, so only nine images are ever fetched --
           the tables are the design decision, not the download.

           Three surfaces wear real maps; the rest are a colour and two numbers.
           That split is deliberate. Metal is a colour, a low roughness and
           metalness 1, and the environment from 01.3 does the reflecting --
           three more downloads would buy nothing you can see.

           One rule, and it is not a taste rule: nothing transmissive. three
           renders the whole scene into a transmission buffer once per
           KHR_materials_transmission object, measured at 28.51ms of GPU against
           2.54ms without. The glass shelves below become solid for exactly that
           reason. If you want the read of glass, use polished stone or metal
           and let 01.3's environment do the reflecting. */
        const THEME = "vault"; // "vault" | "boutique"

        const BOUTIQUE = {
          // Order matters: the first key that matches wins, so anything more
          // specific than "hall" has to be listed above it. hall.light is a
          // glowing strip and keeps whatever the glb gave it.
          "hall.light": { skip: true },
          // The glb's own oak, travertine and plaster are already the boutique.
          oak_panel: { skip: true },
          travertine: { skip: true },
          plaster: { skip: true },
          hall: { tex: "wall", repeat: [4, 2], color: "#efe9e0" },
          shelf_strip: { color: "#b08d57", roughness: 0.3, metalness: 1 },
          glassshelf_edge: { color: "#b08d57", roughness: 0.3, metalness: 1 },
          floor: { tex: "floor", repeat: [8, 5] },
          wall: { tex: "wall", repeat: [6, 2], color: "#efe9e0" },
          ceiling: { tex: "wall", repeat: [6, 4], color: "#f2ece3" },
          rug: { tex: "rug", repeat: [3, 2], color: "#cbbfa9" },
          shelf: { color: "#b08d57", roughness: 0.26, metalness: 1 },
          glassshelf: { color: "#6b5c46", roughness: 0.38, metalness: 0 },
          trim: { color: "#b08d57", roughness: 0.3, metalness: 1 },
          crown: { color: "#b08d57", roughness: 0.3, metalness: 1 },
        };

        /* Cooler, darker, and metal everywhere the boutique used brass. The
           tints are steel rather than gold, and they are pulled DOWN rather
           than up: a vault reads as a vault because the room is dim and the
           niches are the only bright thing in it. */
        const VAULT = {
          // Order matters: first match wins, so hall.light sits above hall. The
          // cove strips, raft glow and downlights are deliberately absent from
          // this table -- they are the light in the room, and replacing their
          // material with a standard one puts the vault in the dark.
          "hall.light": { skip: true },
          oak_panel: { tex: "wall", repeat: [2, 1] },
          travertine: { tex: "rug", repeat: [2, 1], color: "#8e949c" },
          plaster: { tex: "wall", repeat: [4, 3], color: "#aeb4bd" },
          downlight_housing: { color: "#2a2e33", roughness: 0.55, metalness: 1 },
          hall: { tex: "wall", repeat: [4, 2], color: "#8f959d" },
          shelf_strip: { color: "#aab2bd", roughness: 0.18, metalness: 1 },
          glassshelf_edge: { color: "#aab2bd", roughness: 0.18, metalness: 1 },
          floor: { tex: "floor", repeat: [6, 4], color: "#9fa6ae" },
          wall: { tex: "wall", repeat: [8, 3] },
          ceiling: { tex: "wall", repeat: [8, 5], color: "#aeb4bd" },
          rug: { tex: "rug", repeat: [4, 3], color: "#9aa0a8" },
          shelf: { color: "#9aa3ad", roughness: 0.22, metalness: 1 },
          glassshelf: { color: "#6f7782", roughness: 0.3, metalness: 1 },
          trim: { color: "#aab2bd", roughness: 0.18, metalness: 1 },
          crown: { color: "#8f97a1", roughness: 0.25, metalness: 1 },
        };

        const SURFACES = THEME === "vault" ? VAULT : BOUTIQUE;
        const TEX = THEME === "vault" ? "/tex/vault" : "/tex";

        function Surfaces() {
          const room = useGLTF("/env/room.glb");
          /* One call with a fixed set of keys, because hooks run in the same
             order on every render: useTexture cannot be called once per surface
             inside the loop below. */
          const maps = useTexture({
            floorColor: TEX + "/floor/color.jpg",
            floorNormal: TEX + "/floor/normal.jpg",
            floorArm: TEX + "/floor/arm.jpg",
            wallColor: TEX + "/wall/color.jpg",
            wallNormal: TEX + "/wall/normal.jpg",
            wallArm: TEX + "/wall/arm.jpg",
            rugColor: TEX + "/rug/color.jpg",
            rugNormal: TEX + "/rug/normal.jpg",
            rugArm: TEX + "/rug/arm.jpg",
          });

          useEffect(() => {
            const previous = new Map();
            const made = [];

            /* Only the colour maps carry colour. A normal or an arm map holds
               numbers the shader reads as numbers, and tagging one sRGB bends
               every value in it -- the usual reason a roughness map comes out
               washed out and a surface reads flat. */
            for (const [key, texture] of Object.entries(maps)) {
              texture.wrapS = RepeatWrapping;
              texture.wrapT = RepeatWrapping;
              texture.colorSpace = key.endsWith("Color") ? SRGBColorSpace : NoColorSpace;
            }

            /* repeat lives on the texture, not the material, so the wall and
               the ceiling sharing one image would mean whichever set it last
               wins on both. A clone is a fresh transform over the same uploaded
               image: cheap, and it is what lets one download tile at two
               densities. */
            const tiled = (texture, [u, v]) => {
              const copy = texture.clone();
              copy.repeat.set(u, v);
              copy.needsUpdate = true;
              return copy;
            };

            room.scene.traverse((node) => {
              if (!(node instanceof Mesh)) return;
              // GLTFLoader sanitises node.name into an animation-binding path
              // and strips the dots out of it, so "wall.north" arrives as
              // "wallnorth". The glTF name is stashed on userData.name, and
              // matching the sanitised one is how a rename silently does
              // nothing.
              const name = node.userData.name ?? node.name;
              /* Some meshes are called Cube004 and tell you nothing. Their
                 MATERIAL is called oak_panel.wall.north, which tells you
                 everything, so the table gets to match on either. Miss this and
                 a warm oak panel survives every re-skin you write, sitting in
                 the middle of a vault looking like a mistake. */
              const materialName = Array.isArray(node.material)
                ? node.material[0]?.name
                : node.material?.name;
              const pick = (n) =>
                n && Object.keys(SURFACES).find((k) => n === k || n.startsWith(k + "."));
              const key = pick(name) ?? pick(materialName);
              if (!key) return;
              const surface = SURFACES[key];
              if (surface.skip) return;

              const material = new MeshStandardMaterial({
                color: surface.color ?? "#ffffff",
                roughness: surface.roughness ?? 1,
                metalness: surface.metalness ?? 0,
              });

              if (surface.tex) {
                material.map = tiled(maps[surface.tex + "Color"], surface.repeat);
                material.normalMap = tiled(maps[surface.tex + "Normal"], surface.repeat);
                /* One image doing three jobs: ambient occlusion in the red
                   channel, roughness in green, metalness in blue. roughness
                   stays at 1 above so the green channel is the whole answer
                   rather than a ceiling on it. aoMap reads the SECOND uv set by
                   default and room.glb ships one, so it is pointed back at
                   channel 0 -- without that line the occlusion silently does
                   nothing. */
                const arm = tiled(maps[surface.tex + "Arm"], surface.repeat);
                arm.channel = 0;
                material.aoMap = arm;
                material.roughnessMap = arm;
                // The vault's surfaces are metal, so the blue channel is the
                // answer there. The boutique's are wood, plaster and wool, and
                // multiplying by a zero channel would only ever zero them.
                if (THEME === "vault") {
                  material.metalnessMap = arm;
                  material.metalness = 1;
                }
              }

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
              // Only the materials. The clones above are transforms over images
              // drei's cache owns and hands to the next mount; disposing one
              // would pull the image out from under everything still using it.
              for (const material of made) material.dispose();
            };
          }, [room, maps]);

          return null;
        }
        return <Surfaces />;
      })()}`;

/* ── 03 furniture ────────────────────────────────────── */

const PROPS = `      {(() => {
        /* THEME again, and it has to match 02's. The boutique's props are
           exported normalised to fit a roughly 2m cube, so their scale is
           per-axis and lands each one on a measured width, height and depth.
           The vault's come from CGAxis at real-world metres with their origin
           on the floor, so they are placed at y = 0 and scale 1 -- mixing the
           two conventions in one table is why each entry carries its own
           numbers rather than sharing a rule.

           Flush or clearly clear, never a millimetre above: the reference build
           had a rug 4mm off the floor and it streaked. */
        const THEME = "vault"; // "vault" | "boutique"

        const BOUTIQUE_PROPS = [
          { url: "/props/double-door-walnut-grand.glb", position: [6.92, 1.376, 0], yaw: -90, scale: [1.156, 1.785, 0.776] },
          { url: "/props/counter-calacatta-brass.glb", position: [-6.7, 0.526, 1.35], yaw: 90, scale: [1.051, 2.058, 1.258] },
          { url: "/props/sofa-boucle-curved.glb", position: [-0.15, 0.411, 0], yaw: 90, scale: [1.156, 1.164, 0.783] },
          { url: "/props/coffee-table-marble-sculptural.glb", position: [1.95, 0.21, 0], yaw: 18, scale: [0.578, 0.5, 0.578] },
          // One file, two nodes: the chair is downloaded once and cloned.
          { url: "/props/lounge-chair-tan-barrel.glb", position: [3.05, 0.325, -0.8], yaw: -67, scale: [0.42, 0.386, 0.423] },
          { url: "/props/lounge-chair-tan-barrel.glb", position: [3.05, 0.325, 0.8], yaw: -113, scale: [0.42, 0.386, 0.423] },
          { url: "/props/ottoman-boucle-cream.glb", position: [0.9, 0.21, 1.1], yaw: 25, scale: [0.342, 0.446, 0.342] },
          { url: "/props/plinth-cream-stone.glb", position: [-2.4, 0.433, -3.35], yaw: 0, scale: [0.289, 1.939, 0.615] },
          { url: "/props/totem-sculpture-walnut.glb", position: [-2.4, 1.55, -3.35], yaw: 15, scale: [0.684, 0.683, 0.68] },
          { url: "/props/olive-tree-ribbed-planter.glb", position: [6.2, 1.051, -3.2], yaw: 40, scale: [0.88, 1.105, 0.928] },
          { url: "/props/olive-tree-ribbed-planter.glb", position: [-6.2, 1.051, 3.2], yaw: -70, scale: [0.88, 1.105, 0.928] },
        ];

        /* Fewer things, and none of them soft. The bouclé sofa, the marble
           table, the ottoman and both olive trees are gone rather than
           restyled: a vault has no plants in it, and dropping five instances
           buys back most of what the three heavier CGAxis models cost. The
           door and the counter stay because their shapes still read, and 02
           has already re-skinned everything they are made of. */
        const VAULT_PROPS = [
          /* The two survivors get a tint. Their SHAPES still read in a vault;
             their calacatta and walnut do not, and they were the two bright
             warm objects left in a cool dark room. tint multiplies the existing
             map rather than replacing it, so the marble keeps its veining and
             the door keeps its grain -- they just stop being white and brown. */
          { url: "/props/double-door-walnut-grand.glb", position: [6.92, 1.376, 0], yaw: -90, scale: [1.156, 1.785, 0.776], tint: { color: "#4b525b", metalness: 0.85, roughness: 0.32 } },
          { url: "/props/counter-calacatta-brass.glb", position: [-6.7, 0.526, 1.35], yaw: 90, scale: [1.051, 2.058, 1.258], tint: { color: "#59616b", metalness: 0.9, roughness: 0.34 } },
          // 2.82m tall, so it stands on the floor and reads from across the
          // room rather than sitting on anything.
          { url: "/props/vault/space-station-cylindrical-pod.glb", position: [-5.5, 0, -3.05], yaw: 28, scale: [1, 1, 1] },
          // One file, two nodes.
          { url: "/props/vault/space-station-chair.glb", position: [3.05, 0, -0.85], yaw: -67, scale: [1, 1, 1] },
          { url: "/props/vault/space-station-chair.glb", position: [3.05, 0, 0.85], yaw: -113, scale: [1, 1, 1] },
          { url: "/props/vault/space-station-container-crate.glb", position: [-0.3, 0, 0.95], yaw: 12, scale: [1, 1, 1] },
          { url: "/props/vault/space-station-container-crate.glb", position: [1.45, 0, -1.15], yaw: -35, scale: [1, 1, 1] },
        ];

        const PROPS: Array<{
          url: string;
          position: [number, number, number];
          yaw: number;
          scale: [number, number, number];
        }> = THEME === "vault" ? (VAULT_PROPS as any) : (BOUTIQUE_PROPS as any);

        function Prop({ url, position, yaw, scale, tint }: {
          url: string;
          position: [number, number, number];
          yaw: number;
          scale: [number, number, number];
          tint?: { color: string; metalness?: number; roughness?: number };
        }) {
          const { scene } = useGLTF(url);
          // Loaded once per URL, cloned per instance: two chairs are one
          // download and one set of geometry, two nodes in the scene.
          const object = useMemo(() => {
            const copy = scene.clone(true);
            if (!tint) return copy;
            /* The clone shares its materials with the cached original, so
               tinting in place would repaint every other instance and outlive
               this mount. Clone the material too. */
            copy.traverse((node: any) => {
              if (!node.isMesh) return;
              const paint = (m: any) => {
                const next = m.clone();
                next.color.set(tint.color);
                if (tint.metalness !== undefined) next.metalness = tint.metalness;
                if (tint.roughness !== undefined) next.roughness = tint.roughness;
                return next;
              };
              node.material = Array.isArray(node.material)
                ? node.material.map(paint)
                : paint(node.material);
            });
            return copy;
          }, [scene, tint]);
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
const NICHE_OF = `          // 1 to 3 on the north wall, 4 to 6 on the south, in room.glb's order.
          const x = [-4.2, 0, 4.2][(inlet.id - 1) % 3];
          const z = inlet.id <= 3 ? -4.356 : 4.356;`;

const CATALOG = `      {/* One stream per published piece, mounted on its niche anchor. They
          arrive at whatever size they were captured at, which is exactly the
          problem 05.3 measures away -- expect them to overflow the niche. */}
      <WhenEngineReady>
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
        })}
      </WhenEngineReady>`;

const FIT_REF = `              scale={inlet.scale}`;

const CATALOG_FIT = `      {/* The one line 05.2 was missing. A published capture is not authored in
          display units, so at scale 1 a handbag is a thumbnail on a 1.2m shelf.
          The obvious move is to measure the piece and divide -- and getBounds()
          will happily answer, which is the trap: its box is built from whatever
          detail has streamed in so far, so the same asset measures 0.20m one
          second and 0.50m the next, and a scale derived from it lands anywhere
          between a thumbnail and a wardrobe. Measure once, by eye, and ship the
          number: catalog.json carries a scale per piece. */}
      <WhenEngineReady>
        {catalog.inlets.map((inlet) => {
${NICHE_OF}
          return (
            <mirisStream
              key={inlet.uuid}
              args={[{ uuid: inlet.uuid, viewerKey: catalog.viewerKey }]}
              position={[x, 1.2, z]}
              rotation={[0, z < 0 ? 0 : Math.PI, 0]}
${FIT_REF}
            />
          );
        })}
      </WhenEngineReady>`;

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
