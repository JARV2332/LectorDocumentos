"use client";

import dynamic from "next/dynamic";

const ScannerScreen = dynamic(
  () => import("@/components/scanner/ScannerScreen").then((mod) => mod.ScannerScreen),
  {
    loading: () => (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-sm text-white">
        Cargando lector...
      </div>
    ),
  },
);

export function HomeClient() {
  return <ScannerScreen />;
}
