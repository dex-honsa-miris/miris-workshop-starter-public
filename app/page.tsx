"use client";
import dynamic from "next/dynamic";

const Stage = dynamic(() => import("./stage"), { ssr: false });

export default function Page() {
  return <Stage />;
}
