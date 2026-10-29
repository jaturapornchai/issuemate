"use client";

import React, { useLayoutEffect, useRef } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion } from "motion/react";

export { AnimatePresence, motion } from "motion/react";

/**
 * Shared motion language for the whole app (package `motion`, ex framer-motion).
 * One easing curve + one spring so every screen moves the same way.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const SPRING = { type: "spring", stiffness: 480, damping: 38, mass: 0.9 } as const;

/** App-wide defaults. reducedMotion="user" follows the OS "reduce motion" setting
 *  (transform/layout animations are skipped, only opacity fades remain). */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: EASE_OUT }}>
      {children}
    </MotionConfig>
  );
}

/** Cross-fade between top-level views. mode="wait" so two views (and their
 *  data-testids) are never mounted at the same time. */
export function ViewSwitch({
  viewKey,
  children,
  className,
}: {
  viewKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        className={className}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Entrance props for the i-th item of a list: fade + rise, staggered.
 *  ponytail: stagger capped at 10 items so long lists still land in < 0.5s. */
export function rise(i = 0, distance = 8) {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.34, ease: EASE_OUT, delay: Math.min(i, 10) * 0.035 },
  };
}

/** Number that counts up from its previous value whenever `value` changes. */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // from = what is on screen now, so an interrupted count resumes from there
    const show = (n: number) => {
      from.current = n;
      el.textContent = `${n.toFixed(decimals)}${suffix}`;
    };
    const start = from.current;
    if (reduce || start === value) {
      show(value);
      return;
    }
    show(start);
    const controls = animate(start, value, { duration: 0.9, ease: EASE_OUT, onUpdate: show });
    return () => controls.stop();
  }, [value, decimals, suffix, reduce]);

  return <span ref={ref} className={className} />;
}

/** Progress bar fill that grows from 0 to `pct` and glides on later changes. */
export function GrowBar({
  pct,
  className = "",
  delay = 0,
}: {
  pct: number;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`h-full rounded-full ${className}`}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      transition={reduce ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT, delay }}
    />
  );
}
