"use client";

import { SUPPORTED_CRYPTOS } from "@/lib/indicators/types";
import type { SignalStrength } from "@/lib/indicators/types";

const signalColors: Record<string, string> = {
  STRONG_BUY: "#22c55e",
  BUY: "#4ade80",
  NEUTRAL: "#64748b",
  SELL: "#f87171",
  STRONG_SELL: "#ef4444",
};

const signalBg: Record<string, string> = {
  STRONG_BUY: "rgba(34,197,94,0.12)",
  BUY: "rgba(74,222,128,0.08)",
  NEUTRAL: "rgba(100,116,139,0.08)",
  SELL: "rgba(248,113,113,0.08)",
  STRONG_SELL: "rgba(239,68,68,0.12)",
};

const signalLabels: Record<string, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  NEUTRAL: "NEUTRAL",
  SELL: "SELL",
  STRONG_SELL: "STRONG SELL",
};

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
        {entries.map(({ crypto, data }) => (
          <button
            key={crypto.symbol}
            onClick={() => onSelect(crypto.symbol)}
            className="w-full flex items-center justify-between rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] px-4 py-3 transition-all duration-300 hover:bg-[var(--color-bg-card-hover)] hover:border-[var(--color-accent-blue)]/20 hover:-translate-y-0.5 active:scale-[0.99] group"
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

              {/* Score bar mini */}
              <div className="w-12 h-1.5 rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(data.score + 100) / 2}%`,
                    background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)`,
                  }} />
              </div>

              {/* Signal badge */}
              <span className="rounded-lg px-2 py-1 text-[10px] font-bold tracking-wider min-w-[70px] text-center"
                style={{ background: signalBg[data.signal], color: signalColors[data.signal] }}>
                {signalLabels[data.signal]}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
