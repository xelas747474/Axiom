"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedPriceProps {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
}

/**
 * Animated price display with count-up transition + flash on change.
 * Green flash + soft glow when price goes up, red when it goes down.
 */
export function AnimatedPrice({
  value,
  prefix = "$",
  decimals = 2,
  className,
}: AnimatedPriceProps) {
  const [display, setDisplay] = useState<number>(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevValue = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === prevValue.current) return;

    setFlash(value > prevValue.current ? "up" : "down");

    const start = prevValue.current;
    const diff = value - start;
    const duration = 300;
    let startTime: number | null = null;

    function step(ts: number) {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }
    rafRef.current = requestAnimationFrame(step);

    const t = window.setTimeout(() => setFlash(null), 500);
    prevValue.current = value;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t);
    };
  }, [value]);

  const color =
    flash === "up" ? "#22c55e" : flash === "down" ? "#ef4444" : undefined;
  const glow =
    flash === "up"
      ? "0 0 8px rgba(34,197,94,0.35)"
      : flash === "down"
      ? "0 0 8px rgba(239,68,68,0.35)"
      : "none";

  return (
    <span
      className={className}
      style={{
        transition: "color 0.3s ease",
        color,
        textShadow: glow,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
