import React from "react";
import { Layers } from "lucide-react";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-teal-700 text-emerald-950 shadow-glow ring-1 ring-white/20 ${className}`}
    >
      <Layers className="h-[55%] w-[55%]" strokeWidth={2.4} />
    </div>
  );
}
