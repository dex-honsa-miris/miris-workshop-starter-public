import { Html } from "@react-three/drei";

export interface CardData {
  name: string;
  description: string;
  attributes: string[];
}

export default function Card({ card }: { card: Partial<CardData> }) {
  // Written by an agent editing data.json by hand, so nothing here is trusted:
  // a string instead of an array used to blank the whole canvas at step 5.1,
  // immediately before the attendee publishes.
  const attributes = Array.isArray(card?.attributes) ? card.attributes : [];
  return (
    <Html position={[-1.15, 1.2, 0]} transform distanceFactor={1.35} occlude={false}>
      <div className="mw-plate">
        <strong>{card?.name ?? "Untitled"}</strong>
        <p>{card?.description ?? ""}</p>
        <ul>
          {attributes.map((a) => (
            <li key={String(a)}>{String(a)}</li>
          ))}
        </ul>
      </div>
    </Html>
  );
}
