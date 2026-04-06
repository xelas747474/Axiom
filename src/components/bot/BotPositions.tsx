"use client";

import { useBot } from "@/lib/bot/context";
import { TRADED_CRYPTOS } from "@/lib/bot/types";

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmt(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default function BotPositions() {
  const { positions, closePositionManually } = useBot();

  if (positions.length === 0) {
    return (
      <div className="premium-card p-5 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="text-base">📋</span> Positions ouvertes
        </h3>
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-2xl opacity-30">📭</span>
          <p className="text-xs text-[var(--color-text-muted)]">
            Aucune position ouverte
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card p-5 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="text-base">📋</span> Positions ouvertes
        </h3>
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
          {positions.length} active{positions.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] text-[9px] uppercase tracking-widest">
              <th className="text-left px-5 py-2 font-semibold">Crypto</th>
              <th className="text-left px-2 py-2 font-semibold">Direction</th>
              <th className="text-right px-2 py-2 font-semibold">Entrée</th>
              <th className="text-right px-2 py-2 font-semibold">Prix actuel</th>
              <th className="text-right px-2 py-2 font-semibold">P&L</th>
              <th className="text-center px-2 py-2 font-semibold">SL → TP</th>
              <th className="text-right px-2 py-2 font-semibold">Durée</th>
              <th className="text-right px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
              const duration = Date.now() - pos.entryTime;
              const isProfit = pos.pnl >= 0;

              const sl = pos.trailingStopPrice ?? pos.stopLoss;
              const rangeMin = Math.min(sl, pos.takeProfit);
              const rangeMax = Math.max(sl, pos.takeProfit);
              const priceInRange = rangeMax > rangeMin
                ? ((pos.currentPrice - rangeMin) / (rangeMax - rangeMin)) * 100
                : 50;
              const progressPct = Math.max(0, Math.min(100, priceInRange));

              const slDist = pos.direction === "LONG"
                ? (pos.currentPrice - sl) / pos.currentPrice * 100
                : (sl - pos.currentPrice) / pos.currentPrice * 100;
              const nearSL = slDist < 0.5;

              return (
                <tr
                  key={pos.id}
                  className={`border-t border-white/[0.04] transition-all duration-300 hover:bg-white/[0.02] ${
                    nearSL ? "animate-pulse bg-[var(--color-negative)]/5" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-white">{label}</span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      pos.direction === "LONG"
                        ? "bg-[var(--color-positive)]/15 text-[var(--color-positive)]"
                        : "bg-[var(--color-negative)]/15 text-[var(--color-negative)]"
                    }`}>
                      {pos.direction === "LONG" ? "↑" : "↓"} {pos.direction}
                    </span>
                  </td>
                  <td className="px-2 py-3.5 text-right text-white/80 font-mono tabular-nums">{fmt(pos.entryPrice)}</td>
                  <td className="px-2 py-3.5 text-right text-white font-mono tabular-nums font-bold">{fmt(pos.currentPrice)}</td>
                  <td className={`px-2 py-3.5 text-right font-bold font-mono tabular-nums transition-colors duration-300 ${
                    isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                  }`}>
                    <span className="text-xs">{isProfit ? "+" : ""}${pos.pnl.toFixed(2)}</span>
                    <br />
                    <span className="text-[10px] font-normal opacity-75">({isProfit ? "+" : ""}{pos.pnlPct.toFixed(2)}%)</span>
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-[var(--color-negative)] font-mono tabular-nums">{fmt(sl)}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden mx-1 min-w-[40px]">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progressPct}%`,
                            background: pos.direction === "LONG"
                              ? "linear-gradient(90deg, #ef4444, #22c55e)"
                              : "linear-gradient(90deg, #22c55e, #ef4444)",
                          }}
                        />
                      </div>
                      <span className="text-[var(--color-positive)] font-mono tabular-nums">{fmt(pos.takeProfit)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3.5 text-right text-[var(--color-text-muted)] font-mono tabular-nums">
                    {formatDuration(duration)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => closePositionManually(pos.id)}
                      className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-negative)]/10 hover:text-[var(--color-negative)] hover:border-[var(--color-negative)]/30 transition-all"
                    >
                      Fermer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
