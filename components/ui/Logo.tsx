import React from "react";
import { Layers } from "lucide-react";

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-indigo-500 to-cyan-400 text-white shadow-glow ring-1 ring-white/25 ${className}`}
    >
      <Layers className="h-[55%] w-[55%]" strokeWidth={2.4} />
    </div>
  );
}
