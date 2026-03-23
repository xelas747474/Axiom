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

const signalLabels: Record<string, string> = {
  STRONG_BUY: "S.BUY",
  BUY: "BUY",
  NEUTRAL: "HOLD",
  SELL: "SELL",
  STRONG_SELL: "S.SELL",
};

interface CryptoSelectorProps {
  selected: string;
  onSelect: (symbol: string) => void;
  signals?: Record<string, { score: number; signal: SignalStrength; price: number; change: number }>;
}

export default function CryptoSelector({ selected, onSelect, signals }: CryptoSelectorProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
      {SUPPORTED_CRYPTOS.map((crypto) => {
        const isActive = selected === crypto.symbol;
        const sig = signals?.[crypto.symbol];

        return (
          <button
            key={crypto.symbol}
            onClick={() => onSelect(crypto.symbol)}
            className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-300 active:scale-[0.97] ${
              isActive
                ? "bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)]/30 shadow-lg shadow-[var(--color-accent-blue)]/10"
                : "border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-white hover:border-[var(--color-accent-blue)]/20"
            }`}
          >
            <span className="font-bold">{crypto.label}</span>
            {sig && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: signalColors[sig.signal] }} />
                <span className="tabular-nums text-[10px] font-bold" style={{ color: signalColors[sig.signal] }}>
                  {signalLabels[sig.signal]}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
