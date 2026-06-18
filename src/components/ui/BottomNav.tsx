"use client";

import { cn } from "@/lib/utils/cn";
import type { ScanMode } from "@/lib/types/documents";

interface BottomNavProps {
  mode: ScanMode;
  onChange: (mode: ScanMode) => void;
}

const NAV_ITEMS: Array<{ id: ScanMode; label: string; icon: string }> = [
  { id: "dpi", label: "Escanear DPI", icon: "🪪" },
  { id: "license", label: "Escanear Licencia", icon: "🚗" },
];

export function BottomNav({ mode, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === mode;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 px-2 py-3 text-[11px] font-semibold transition active:scale-95",
                isActive ? "text-emerald-600" : "text-zinc-500",
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              <span
                className={cn(
                  "mt-0.5 h-1 w-8 rounded-full transition",
                  isActive ? "bg-emerald-500" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
