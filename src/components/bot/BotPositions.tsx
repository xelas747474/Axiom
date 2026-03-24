"use client";

import { useBot } from "@/lib/bot/context";
import { TRADED_CRYPTOS } from "@/lib/bot/types";
import Card from "@/components/Card";

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
  const { positions, closePositionManually, config } = useBot();

  if (positions.length === 0) {
    return (
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <h3 className="text-sm font-bold text-white mb-3">📋 Positions ouvertes</h3>
        <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
          Aucune position ouverte
        </p>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
      <h3 className="text-sm font-bold text-white mb-3">📋 Positions ouvertes</h3>
      <div className="overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full min-w-[700px] text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-2">Crypto</th>
              <th className="text-left px-2 py-2">Direction</th>
              <th className="text-right px-2 py-2">Entrée</th>
              <th className="text-right px-2 py-2">Prix actuel</th>
              <th className="text-right px-2 py-2">P&L</th>
              <th className="text-center px-2 py-2">SL → TP</th>
              <th className="text-right px-2 py-2">Durée</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
              const duration = Date.now() - pos.entryTime;
              const isProfit = pos.pnl >= 0;

              // Progress bar: where price is between SL and TP
              const sl = pos.trailingStopPrice ?? pos.stopLoss;
              const rangeMin = Math.min(sl, pos.takeProfit);
              const rangeMax = Math.max(sl, pos.takeProfit);
              const priceInRange = rangeMax > rangeMin
                ? ((pos.currentPrice - rangeMin) / (rangeMax - rangeMin)) * 100
                : 50;
              const progressPct = Math.max(0, Math.min(100, priceInRange));

              // Danger: price near SL
              const slDist = pos.direction === "LONG"
                ? (pos.currentPrice - sl) / pos.currentPrice * 100
                : (sl - pos.currentPrice) / pos.currentPrice * 100;
              const nearSL = slDist < 0.5;

              return (
                <tr
                  key={pos.id}
                  className={`border-t border-[var(--color-border-subtle)]/30 transition-colors ${
                    nearSL ? "animate-pulse bg-[var(--color-negative)]/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-white">{label}</td>
                  <td className="px-2 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      pos.direction === "LONG"
                        ? "bg-[var(--color-positive)]/15 text-[var(--color-positive)]"
                        : "bg-[var(--color-negative)]/15 text-[var(--color-negative)]"
                    }`}>
                      {pos.direction === "LONG" ? "🟢" : "🔴"} {pos.direction}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right text-white font-mono tabular-nums">{fmt(pos.entryPrice)}</td>
                  <td className="px-2 py-3 text-right text-white font-mono tabular-nums">{fmt(pos.currentPrice)}</td>
                  <td className={`px-2 py-3 text-right font-bold font-mono tabular-nums transition-colors duration-300 ${
                    isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"
                  }`}>
                    {isProfit ? "+" : ""}${pos.pnl.toFixed(2)}
                    <br />
                    <span className="text-[10px] font-normal">({isProfit ? "+" : ""}{pos.pnlPct.toFixed(2)}%)</span>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-[var(--color-negative)] font-mono tabular-nums">{fmt(sl)}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-bg-primary)] overflow-hidden mx-1 min-w-[40px]">
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
                  <td className="px-2 py-3 text-right text-[var(--color-text-muted)] font-mono tabular-nums">
                    {formatDuration(duration)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => closePositionManually(pos.id)}
                      className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-white transition-all"
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
    </Card>
  );
}
