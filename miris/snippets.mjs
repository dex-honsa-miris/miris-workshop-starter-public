const PEDESTAL = `      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 0.5, 48]} />
        <meshStandardMaterial color={0x111215} roughness={0.55} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.015, 12, 64]} />
        <meshBasicMaterial color={0xe8e9ed} />
      </mesh>`;

const ENVIRONMENT = `      <Environment files="/env/white-chapel.hdr" environmentIntensity={1.6} />`;

const STREAM = `      <mirisStream
        position={[0.043, 0.64, 0.221]}
        scale={0.138}
        args={[{
          uuid: "2b21e89f-ef5d-4175-bbdf-03e8649bcb76",
          viewerKey: "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4",
        }]}
      />`;

// pedestal, environment and stream share the `scene` marker, so each snippet
// contains the ones before it. Writing them non-cumulatively would make step
// 2.2 delete the pedestal that step 2.1 just added.
const LABEL_HTML = `  // Painted by ctx.drawElementImage() in Chrome, an SVG foreignObject elsewhere.
  const label = useHtmlTexture(
    data?.card &&
      \`<div class="mw-plate">
        <strong>\${data.card.name}</strong>
        <p>\${data.card.description}</p>
        <ul>\${data.card.attributes.map((a) => \`<li>\${a}</li>\`).join("")}</ul>
      </div>\`,
  );`;

/* Filled by plan 2. The four maps must stay key-for-key identical: a fill id
   present in three of them and absent from PARTS crashes the sidebar. */
export const SNIPPETS = {};
export const PARTS = {};
export const CLEARS_TO = {};
export const MARKER_FOR = {};
