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

export const SNIPPETS = {
  pedestal: PEDESTAL,
  environment: `${PEDESTAL}\n${ENVIRONMENT}`,
  stream: `${PEDESTAL}\n${ENVIRONMENT}\n${STREAM}`,
  card: `      {data.card ? <Card card={data.card} /> : null}`,
  labelHtml: LABEL_HTML,
  // Shares the `card` marker deliberately, so the plane replaces step 5.2's
  // overlay rather than adding a second card beside it.
  labelMesh: `      {label.texture && (
        <Billboard position={[-1.15, 1.2, 0]}>
          <mesh>
            <planeGeometry args={[label.width, label.height]} />
            <meshBasicMaterial map={label.texture} transparent toneMapped={false} />
          </mesh>
        </Billboard>
      )}`,
};

/* What each step actually adds. SNIPPETS is cumulative because the scene ones
   share a marker, so showing an attendee SNIPPETS.environment would show them
   the pedestal they already have. The Fill button writes the cumulative block;
   the card shows the part. */
export const PARTS = {
  pedestal: PEDESTAL,
  environment: ENVIRONMENT,
  stream: STREAM,
  card: SNIPPETS.card,
  labelHtml: LABEL_HTML,
  labelMesh: SNIPPETS.labelMesh,
};

/* Clearing a step puts the block back to the step before it, not to empty.
   Three steps share the `scene` marker because the snippets are cumulative, so
   a marker-wide clear at 2.2 took 2.1's pedestal with it. null means there is
   nothing before it and the block returns to the template's blank. */
export const CLEARS_TO = {
  pedestal: null,
  environment: "pedestal",
  stream: "environment",
  card: null,
  labelHtml: null,
  labelMesh: "card",
};

export const MARKER_FOR = {
  pedestal: "scene",
  environment: "scene",
  stream: "scene",
  card: "card",
  labelHtml: "label",
  labelMesh: "card",
};
