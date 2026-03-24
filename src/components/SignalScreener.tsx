"use client";

import { SUPPORTED_CRYPTOS } from "@/lib/indicators/types";
import type { SignalStrength } from "@/lib/indicators/types";
import { getSignalInfo } from "@/lib/signals";

interface ScreenerEntry {
  score: number;
  signal: SignalStrength;
  price: number;
  change: number;
}

interface SignalScreenerProps {
  signals: Record<string, ScreenerEntry>;
  onSelect: (symbol: string) => void;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(6)}`;
}

export default function SignalScreener({ signals, onSelect }: SignalScreenerProps) {
  const entries = SUPPORTED_CRYPTOS
    .map((crypto) => ({ crypto, data: signals[crypto.symbol] }))
    .filter((e) => e.data)
    .sort((a, b) => (b.data?.score ?? 0) - (a.data?.score ?? 0));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-accent-blue)] to-[var(--color-accent-purple)] text-[10px]">AI</span>
        Screener — Signaux IA
      </h3>
      <div className="space-y-1.5">
        {entries.map(({ crypto, data }) => {
          const info = getSignalInfo(data.score);
          const isPositive = data.score >= 20;
          const isNegative = data.score <= -20;
          const rowBg = isPositive
            ? "rgba(34,197,94,0.05)"
            : isNegative
              ? "rgba(239,68,68,0.05)"
              : "transparent";

          return (
            <button
              key={crypto.symbol}
              onClick={() => onSelect(crypto.symbol)}
              className="w-full flex items-center justify-between rounded-xl border border-[var(--color-border-subtle)] px-4 py-3 transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-accent-blue)]/20 hover:-translate-y-0.5 active:scale-[0.99] group"
              style={{ backgroundColor: rowBg }}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white group-hover:text-[var(--color-accent-blue)] transition-colors">
                  {crypto.label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{crypto.name}</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-semibold text-white tabular-nums">{formatPrice(data.price)}</p>
                  <p className={`text-[10px] font-medium tabular-nums ${data.change >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                    {data.change >= 0 ? "+" : ""}{data.change.toFixed(2)}%
                  </p>
                </div>

                {/* Score bar mini with cursor */}
                <div className="relative w-14 h-1.5 rounded-full overflow-hidden bg-[var(--color-bg-primary)]">
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: "linear-gradient(90deg, #dc2626, #f97316, #a3a3a3, #22c55e, #15803d)", opacity: 0.4 }} />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-1.5 rounded-full shadow-md transition-all duration-500"
                    style={{
                      left: `${Math.max(0, Math.min(100, (data.score + 100) / 2))}%`,
                      transform: `translate(-50%, -50%)`,
                      backgroundColor: info.color,
                      boxShadow: `0 0 6px ${info.color}60`,
                    }}
                  />
                </div>

                {/* Signal badge */}
                <span className="rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider min-w-[80px] text-center transition-all duration-500"
                  style={{
                    background: info.bgColor,
                    color: info.color,
                    textShadow: `0 0 8px ${info.color}30`,
                  }}>
                  <span className="hidden sm:inline">{info.emoji} </span>{info.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
