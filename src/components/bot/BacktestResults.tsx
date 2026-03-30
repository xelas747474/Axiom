"use client";

import { useMemo, useState, useEffect } from "react";
import type { BacktestResult } from "./BacktestPanel";

// ============================================
// Backtest Results — Hero stats, portfolio chart, stats grid, trade distribution
// ============================================

function CountUp({ value, decimals = 2, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

function PortfolioChart({ curve, initialCapital }: { curve: { t: number; v: number }[]; initialCapital: number }) {
  if (curve.length < 2) return null;

  const W = 700;
  const H = 220;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const minV = Math.min(...curve.map((p) => p.v), initialCapital) * 0.995;
  const maxV = Math.max(...curve.map((p) => p.v), initialCapital) * 1.005;
  const minT = curve[0].t;
  const maxT = curve[curve.length - 1].t;

  const x = (t: number) => PAD.left + ((t - minT) / (maxT - minT)) * cW;
  const y = (v: number) => PAD.top + (1 - (v - minV) / (maxV - minV)) * cH;

  const refY = y(initialCapital);
  const points = curve.map((p) => `${x(p.t)},${y(p.v)}`).join(" ");

  // Green/red areas
  const lastPoint = curve[curve.length - 1];
  const isProfit = lastPoint.v >= initialCapital;

  const areaPoints = curve.map((p) => `${x(p.t)},${y(p.v)}`).join(" ");
  const areaPath = `${areaPoints} ${x(lastPoint.t)},${refY} ${x(curve[0].t)},${refY}`;

  // Y-axis labels
  const yLabels: number[] = [];
  const step = (maxV - minV) / 4;
  for (let i = 0; i <= 4; i++) yLabels.push(minV + step * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid lines */}
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
            ${Math.round(v).toLocaleString()}
          </text>
        </g>
      ))}

      {/* Reference line (initial capital) */}
      <line x1={PAD.left} y1={refY} x2={W - PAD.right} y2={refY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />

      {/* Area fill */}
      <polygon points={areaPath} fill={isProfit ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"} />

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke={isProfit ? "#22c55e" : "#ef4444"}
        strokeWidth="2"
        strokeLinejoin="round"
        className="animate-draw-line"
      />

      {/* End dot */}
      <circle cx={x(lastPoint.t)} cy={y(lastPoint.v)} r="4" fill={isProfit ? "#22c55e" : "#ef4444"} />
    </svg>
  );
}

function StatsGrid({ stats }: { stats: BacktestResult["stats"] }) {
  const items = [
    { label: "Trades", value: stats.totalTrades.toString(), color: "text-white" },
    { label: "Win Rate", value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 55 ? "text-[var(--color-positive)]" : stats.winRate >= 45 ? "text-yellow-400" : "text-[var(--color-negative)]" },
    { label: "Profit Factor", value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1.5 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]" },
    { label: "Sharpe Ratio", value: stats.sharpeRatio.toFixed(2), color: stats.sharpeRatio >= 1 ? "text-[var(--color-positive)]" : "text-yellow-400" },
    { label: "Max Drawdown", value: `${stats.maxDrawdown.toFixed(2)}%`, color: "text-[var(--color-negative)]" },
    { label: "Gain Moyen", value: `${stats.avgWin.toFixed(2)}%`, color: "text-[var(--color-positive)]" },
    { label: "Perte Moyenne", value: `${stats.avgLoss.toFixed(2)}%`, color: "text-[var(--color-negative)]" },
    { label: "Meilleur Trade", value: `${stats.bestTrade.toFixed(2)}%`, color: "text-[var(--color-positive)]" },
    { label: "Pire Trade", value: `${stats.worstTrade.toFixed(2)}%`, color: "text-[var(--color-negative)]" },
    { label: "Win Streak", value: stats.winStreak.toString(), color: "text-[var(--color-positive)]" },
    { label: "Lose Streak", value: stats.loseStreak.toString(), color: "text-[var(--color-negative)]" },
    { label: "Espérance", value: `$${stats.expectedValue.toFixed(2)}`, color: stats.expectedValue >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="rounded-lg bg-[var(--color-bg-primary)]/40 p-3 text-center animate-fade-in-up"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{item.label}</div>
          <div className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function TradeDistribution({ trades }: { trades: BacktestResult["trades"] }) {
  const buckets = useMemo(() => {
    if (trades.length === 0) return [];
    const ranges = [
      { label: "< -4%", min: -Infinity, max: -4 },
      { label: "-4 à -2%", min: -4, max: -2 },
      { label: "-2 à -1%", min: -2, max: -1 },
      { label: "-1 à 0%", min: -1, max: 0 },
      { label: "0 à 1%", min: 0, max: 1 },
      { label: "1 à 2%", min: 1, max: 2 },
      { label: "2 à 4%", min: 2, max: 4 },
      { label: "> 4%", min: 4, max: Infinity },
    ];
    return ranges.map((r) => ({
      label: r.label,
      count: trades.filter((t) => t.pnlPct >= r.min && t.pnlPct < r.max).length,
      isPositive: r.min >= 0,
    }));
  }, [trades]);

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-1.5">
      {buckets.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-20 text-[10px] text-right text-[var(--color-text-muted)] font-mono shrink-0">{b.label}</span>
          <div className="flex-1 h-5 bg-[var(--color-bg-primary)]/40 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-700 ${b.isPositive ? "bg-[var(--color-positive)]/60" : "bg-[var(--color-negative)]/60"}`}
              style={{ width: `${(b.count / maxCount) * 100}%`, animationDelay: `${i * 50}ms` }}
            />
          </div>
          <span className="w-6 text-[10px] text-[var(--color-text-muted)] font-mono">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

function CryptoPerformance({ trades }: { trades: BacktestResult["trades"] }) {
  const byCrypto = useMemo(() => {
    const map: Record<string, { wins: number; losses: number; pnl: number }> = {};
    for (const t of trades) {
      const c = t.crypto;
      if (!map[c]) map[c] = { wins: 0, losses: 0, pnl: 0 };
      if (t.result === "win") map[c].wins++;
      else map[c].losses++;
      map[c].pnl += t.pnl;
    }
    return Object.entries(map).map(([crypto, data]) => ({
      crypto,
      total: data.wins + data.losses,
      winRate: data.wins / (data.wins + data.losses) * 100,
      pnl: data.pnl,
    }));
  }, [trades]);

  if (byCrypto.length === 0) return null;

  return (
    <div className="space-y-2">
      {byCrypto.map((c) => (
        <div key={c.crypto} className="flex items-center justify-between rounded-lg bg-[var(--color-bg-primary)]/40 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{c.crypto}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{c.total} trades</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              WR: <span className={c.winRate >= 55 ? "text-[var(--color-positive)]" : "text-yellow-400"}>{c.winRate.toFixed(0)}%</span>
            </span>
            <span className={`text-sm font-mono font-bold ${c.pnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
              {c.pnl >= 0 ? "+" : ""}{c.pnl.toFixed(2)}$
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  result: BacktestResult;
}

export default function BacktestResults({ result }: Props) {
  const { stats, trades, curve, config } = result;
  const isProfit = stats.totalReturn >= 0;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Hero P&L */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Performance sur {config.days} jours
        </div>
        <div className={`text-4xl font-bold font-mono ${isProfit ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
          <CountUp value={stats.totalReturn} prefix={isProfit ? "+" : ""} suffix="%" />
        </div>
        <div className={`text-lg font-mono mt-1 ${isProfit ? "text-[var(--color-positive)]/70" : "text-[var(--color-negative)]/70"}`}>
          <CountUp value={stats.totalPnl} prefix={isProfit ? "+$" : "-$"} />
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)]">Trades</div>
            <div className="text-sm font-bold text-white">{stats.totalTrades}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)]">Win Rate</div>
            <div className="text-sm font-bold text-white">{stats.winRate.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)]">Sharpe</div>
            <div className="text-sm font-bold text-white">{stats.sharpeRatio.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[var(--color-text-muted)]">Max DD</div>
            <div className="text-sm font-bold text-[var(--color-negative)]">{stats.maxDrawdown.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Portfolio curve */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Courbe du Portfolio</h3>
        <PortfolioChart curve={curve} initialCapital={config.initialCapital} />
      </div>

      {/* Stats grid */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Statistiques Détaillées</h3>
        <StatsGrid stats={stats} />
      </div>

      {/* Trade distribution + crypto performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Distribution des Trades</h3>
          <TradeDistribution trades={trades} />
        </div>
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Performance par Crypto</h3>
          <CryptoPerformance trades={trades} />
        </div>
      </div>
    </div>
  );
}
