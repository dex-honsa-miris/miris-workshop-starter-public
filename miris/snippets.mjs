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
        args={[{ uuid: data.uuid || DEMO_UUID, viewerKey: data.viewerKey || VIEWER_KEY }]}
      />`;

// pedestal, environment and stream share the `scene` marker, so each snippet
// contains the ones before it. Writing them non-cumulatively would make step
// 2.2 delete the pedestal that step 2.1 just added.
export const SNIPPETS = {
  pedestal: PEDESTAL,
  environment: `${PEDESTAL}\n${ENVIRONMENT}`,
  stream: `${PEDESTAL}\n${ENVIRONMENT}\n${STREAM}`,
  card: `      {data.card ? <Card card={data.card} /> : null}`,
};

export const MARKER_FOR = {
  pedestal: "scene",
  environment: "scene",
  stream: "scene",
  card: "card",
};
