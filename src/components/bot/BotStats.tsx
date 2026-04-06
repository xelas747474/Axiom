"use client";

import { useBot } from "@/lib/bot/context";
import { TRADED_CRYPTOS } from "@/lib/bot/types";
import { AnimatedPrice } from "@/components/AnimatedPrice";

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function BotStats() {
  const { config, state, positions, history, curve } = useBot();

  const pnlPct = config.initialCapital > 0
    ? ((state.portfolioValue - config.initialCapital) / config.initialCapital) * 100
    : 0;
  const isProfit = pnlPct >= 0;

  // Win rate
  const totalTrades = history.length;
  const wins = history.filter((t) => t.result === "win").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Average win/loss for risk-reward
  const winTrades = history.filter((t) => t.result === "win");
  const lossTrades = history.filter((t) => t.result === "loss");
  const avgWin = winTrades.length > 0 ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length) : 1;
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Today P&L
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayTrades = history.filter((t) => t.exitTime >= todayStart);
  const todayPnl = todayTrades.reduce((s, t) => s + t.pnl, 0);

  // Sparkline data from curve
  const sparkData = curve.slice(-20).map((p) => p.v);

  const winRateAccent = winRate >= 55 ? "positive" : winRate <= 45 ? "negative" : "";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
      {/* Portfolio Value */}
      <div className={`premium-card ${isProfit ? "premium-card-positive" : "premium-card-negative"} p-4`}>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Capital</p>
            <p className={`text-lg font-bold font-mono tabular-nums mt-1 transition-colors duration-500 ${isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
              <AnimatedPrice value={state.portfolioValue} />
            </p>
            <p className={`text-xs font-mono tabular-nums ${isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
              {isProfit ? "+" : ""}{pnlPct.toFixed(2)}%
            </p>
          </div>
          <Sparkline data={sparkData} color={isProfit ? "#22c55e" : "#ef4444"} />
        </div>
      </div>

      {/* Today P&L */}
      <div className={`premium-card ${todayPnl >= 0 ? "premium-card-positive" : "premium-card-negative"} p-4`}>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">P&L Aujourd&apos;hui</p>
        <p className={`text-lg font-bold font-mono tabular-nums mt-1 ${todayPnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
          {todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {todayTrades.length} trade{todayTrades.length !== 1 ? "s" : ""} aujourd&apos;hui
        </p>
      </div>

      {/* Win Rate */}
      <div className={`premium-card ${winRateAccent ? `premium-card-${winRateAccent}` : ""} p-4`}>
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Win Rate</p>
        <p className={`text-lg font-bold font-mono tabular-nums mt-1 ${winRate >= 55 ? "text-[var(--color-positive)]" : winRate <= 45 ? "text-[var(--color-negative)]" : "text-white"}`}>
          {winRate.toFixed(1)}%
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${winRate >= 55 ? "bg-[var(--color-positive)]" : winRate <= 45 ? "bg-[var(--color-negative)]" : "bg-[var(--color-warning)]"}`} style={{ width: `${winRate}%` }} />
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">R:R {rrRatio.toFixed(1)}</span>
        </div>
      </div>

      {/* Active Trades */}
      <div className="premium-card p-4">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Trades Actifs</p>
        <p className="text-lg font-bold font-mono tabular-nums mt-1 text-white">
          {positions.length}/{config.maxConcurrentTrades}
        </p>
        <div className="space-y-0.5 mt-1">
          {positions.slice(0, 3).map((pos) => {
            const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
            return (
              <p key={pos.id} className={`text-[10px] font-mono tabular-nums ${pos.pnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                {label} {pos.direction} {pos.pnl >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
              </p>
            );
          })}
          {positions.length === 0 && (
            <p className="text-[10px] text-[var(--color-text-muted)]">Aucune position</p>
          )}
        </div>
      </div>
    </div>
  );
}
