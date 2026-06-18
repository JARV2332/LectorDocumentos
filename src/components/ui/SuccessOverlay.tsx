"use client";

export function SuccessOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 animate-success-flash">
      <div className="absolute inset-3 rounded-2xl border-4 border-emerald-400 shadow-[0_0_32px_rgba(52,211,153,0.65)]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-20 w-20 animate-success-pop items-center justify-center rounded-full bg-emerald-500 shadow-lg">
          <svg
            viewBox="0 0 24 24"
            className="h-10 w-10 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
