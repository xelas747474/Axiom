"use client";

import { useState, useCallback, useRef } from "react";
import { STRATEGIES } from "@/lib/bot/types";
import type { BotStrategy } from "@/lib/bot/types";
import type { BacktestResult, BacktestStats } from "./BacktestPanel";

// ============================================
// Strategy Comparison — 3 parallel backtests, winner display, comparison table, overlaid curves
// ============================================

const STRATEGY_LIST: { key: BotStrategy; emoji: string; label: string; color: string }[] = [
  { key: "conservative", emoji: "\u{1F6E1}\uFE0F", label: "Conservateur", color: "#3b82f6" },
  { key: "balanced", emoji: "\u2696\uFE0F", label: "\u00c9quilibr\u00e9", color: "#a855f7" },
  { key: "aggressive", emoji: "\u{1F525}", label: "Agressif", color: "#f59e0b" },
];

const PERIODS: { label: string; value: 30 | 90 | 180 | 365 }[] = [
  { label: "30j", value: 30 },
  { label: "90j", value: 90 },
  { label: "180j", value: 180 },
  { label: "1 an", value: 365 },
];

const CRYPTOS: { id: "bitcoin" | "ethereum" | "solana"; label: string }[] = [
  { id: "bitcoin", label: "BTC" },
  { id: "ethereum", label: "ETH" },
  { id: "solana", label: "SOL" },
];

function OverlaidChart({ results }: { results: BacktestResult[] }) {
  if (results.length === 0) return null;

  const W = 700;
  const H = 240;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allValues = results.flatMap((r) => r.curve.map((p) => p.v));
  const allTimes = results.flatMap((r) => r.curve.map((p) => p.t));
  const initCap = results[0].config.initialCapital;

  const minV = Math.min(...allValues, initCap) * 0.995;
  const maxV = Math.max(...allValues, initCap) * 1.005;
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes);

  const x = (t: number) => PAD.left + ((t - minT) / (maxT - minT || 1)) * cW;
  const y = (v: number) => PAD.top + (1 - (v - minV) / (maxV - minV || 1)) * cH;

  const refY = y(initCap);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Reference line */}
      <line x1={PAD.left} y1={refY} x2={W - PAD.right} y2={refY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={PAD.left - 8} y={refY + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
        ${initCap.toLocaleString()}
      </text>

      {/* Curves */}
      {results.map((r, i) => {
        const color = STRATEGY_LIST[i]?.color ?? "#fff";
        const points = r.curve.map((p) => `${x(p.t)},${y(p.v)}`).join(" ");
        return (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.85"
            className="animate-draw-line"
          />
        );
      })}

      {/* Legend */}
      {results.map((r, i) => {
        const s = STRATEGY_LIST.find((s) => s.key === r.config.strategy);
        if (!s) return null;
        const lx = PAD.left + 10 + i * 150;
        return (
          <g key={i}>
            <circle cx={lx} cy={H - 10} r="4" fill={s.color} />
            <text x={lx + 10} y={H - 6} fill="rgba(255,255,255,0.6)" fontSize="10">
              {s.emoji} {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ComparisonTable({ results }: { results: BacktestResult[] }) {
  const metrics: { label: string; key: keyof BacktestStats; format: (v: number) => string; higherBetter: boolean }[] = [
    { label: "Rendement", key: "totalReturn", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`, higherBetter: true },
    { label: "Win Rate", key: "winRate", format: (v) => `${v.toFixed(1)}%`, higherBetter: true },
    { label: "Trades", key: "totalTrades", format: (v) => v.toString(), higherBetter: false },
    { label: "Profit Factor", key: "profitFactor", format: (v) => v === Infinity ? "\u221E" : v.toFixed(2), higherBetter: true },
    { label: "Sharpe Ratio", key: "sharpeRatio", format: (v) => v.toFixed(2), higherBetter: true },
    { label: "Max Drawdown", key: "maxDrawdown", format: (v) => `${v.toFixed(2)}%`, higherBetter: false },
    { label: "Gain Moyen", key: "avgWin", format: (v) => `${v.toFixed(2)}%`, higherBetter: true },
    { label: "Perte Moyenne", key: "avgLoss", format: (v) => `${v.toFixed(2)}%`, higherBetter: false },
    { label: "Esp\u00e9rance", key: "expectedValue", format: (v) => `$${v.toFixed(2)}`, higherBetter: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)]">
            <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-normal uppercase tracking-wider">M\u00e9trique</th>
            {results.map((r) => {
              const s = STRATEGY_LIST.find((s) => s.key === r.config.strategy);
              return (
                <th key={r.config.strategy} className="text-center py-2 px-3 font-semibold text-white">
                  {s?.emoji} {s?.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const values = results.map((r) => r.stats[m.key] as number);
            const bestIdx = m.higherBetter
              ? values.indexOf(Math.max(...values))
              : values.indexOf(Math.min(...values));

            return (
              <tr key={m.key} className="border-b border-[var(--color-border-subtle)]/30">
                <td className="py-2 px-3 text-[var(--color-text-muted)]">{m.label}</td>
                {results.map((r, i) => {
                  const val = r.stats[m.key] as number;
                  const isBest = i === bestIdx;
                  return (
                    <td key={i} className={`py-2 px-3 text-center font-mono ${isBest ? "text-[var(--color-positive)] font-bold" : "text-white/70"}`}>
                      {m.format(val)} {isBest && "\u{1F3C6}"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StrategyComparison() {
  const [crypto, setCrypto] = useState<"bitcoin" | "ethereum" | "solana">("bitcoin");
  const [days, setDays] = useState<30 | 90 | 180 | 365>(90);
  const [capital, setCapital] = useState(10000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<BotStrategy, number>>({ conservative: 0, balanced: 0, aggressive: 0 });
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const workersRef = useRef<Worker[]>([]);

  const launch = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setError(null);
    setProgress({ conservative: 0, balanced: 0, aggressive: 0 });

    // Terminate previous workers
    workersRef.current.forEach((w) => w.terminate());
    workersRef.current = [];

    try {
      const res = await fetch(`/api/market/ohlcv?crypto=${crypto}&days=${days}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des donn\u00e9es");
      const ohlcv = await res.json();
      if (!ohlcv.data || ohlcv.data.length < 10) throw new Error("Donn\u00e9es insuffisantes");

      const completed: BacktestResult[] = [];
      let doneCount = 0;

      for (const strat of STRATEGY_LIST) {
        const stratConfig = STRATEGIES[strat.key];
        const worker = new Worker("/workers/backtest-worker.js");
        workersRef.current.push(worker);

        worker.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === "progress") {
            setProgress((prev) => ({ ...prev, [strat.key]: msg.progress }));
          } else if (msg.type === "complete") {
            completed.push({
              config: { crypto, days, strategy: strat.key, initialCapital: capital, allocations: { BTCUSDT: 50, ETHUSDT: 30, SOLUSDT: 20 } },
              stats: msg.result.stats,
              trades: msg.result.trades,
              curve: msg.result.curve,
            });
            doneCount++;
            if (doneCount === 3) {
              // Sort by strategy order
              const ordered = STRATEGY_LIST.map((s) => completed.find((r) => r.config.strategy === s.key)!).filter(Boolean);
              setResults(ordered);
              setRunning(false);
            }
            worker.terminate();
          } else if (msg.type === "error") {
            setError(msg.error);
            setRunning(false);
          }
        };

        worker.postMessage({
          type: "run",
          ohlcData: ohlcv.data,
          config: {
            strategy: strat.key,
            initialCapital: capital,
            stopLossPct: stratConfig.stopLossPct,
            takeProfitPct: stratConfig.takeProfitPct,
            scoreThreshold: stratConfig.scoreThreshold,
            positionSizePct: stratConfig.positionSizePct,
            trailingStop: true,
            maxDrawdownPct: 15,
            cooldownBars: 3,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setRunning(false);
    }
  }, [crypto, days, capital]);

  const winner = results.length === 3
    ? results.reduce((best, r) => (r.stats.totalReturn > best.stats.totalReturn ? r : best))
    : null;
  const winnerInfo = winner ? STRATEGY_LIST.find((s) => s.key === winner.config.strategy) : null;

  const avgProgress = (progress.conservative + progress.balanced + progress.aggressive) / 3;

  const recommendation = winner
    ? winner.stats.totalReturn > 5
      ? `La strat\u00e9gie ${winnerInfo?.label} offre le meilleur rendement avec un Sharpe de ${winner.stats.sharpeRatio.toFixed(2)}. Recommand\u00e9e pour cette p\u00e9riode.`
      : winner.stats.totalReturn > 0
        ? `Rendements modestes. La strat\u00e9gie ${winnerInfo?.label} performe l\u00e9g\u00e8rement mieux, mais les conditions de march\u00e9 limitent les gains.`
        : `March\u00e9 d\u00e9favorable. Aucune strat\u00e9gie ne g\u00e9n\u00e8re de profit. Consid\u00e9rez de rester en dehors du march\u00e9.`
    : "";

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Config */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Configuration de la Comparaison</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">P\u00e9riode</label>
            <div className="flex gap-1.5">
              {PERIODS.map((p) => (
                <button key={p.value} onClick={() => setDays(p.value)} disabled={running}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${days === p.value ? "bg-[var(--color-accent-blue)] text-white" : "bg-[var(--color-bg-primary)]/60 text-[var(--color-text-muted)] hover:text-white"} disabled:opacity-50`}
                >{p.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Crypto</label>
            <div className="flex gap-1.5">
              {CRYPTOS.map((c) => (
                <button key={c.id} onClick={() => setCrypto(c.id)} disabled={running}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${crypto === c.id ? "bg-[var(--color-accent-blue)] text-white" : "bg-[var(--color-bg-primary)]/60 text-[var(--color-text-muted)] hover:text-white"} disabled:opacity-50`}
                >{c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Capital</label>
            <input type="number" value={capital} onChange={(e) => setCapital(Math.max(100, Number(e.target.value)))} disabled={running}
              className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/60 px-3 py-1.5 text-xs font-mono text-white outline-none focus:border-[var(--color-accent-blue)]/50 disabled:opacity-50"
              min={100} step={100}
            />
          </div>
        </div>

        {/* Progress */}
        {running && (
          <div className="space-y-2 animate-fade-in-up">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>Comparaison en cours...</span>
              <span className="font-mono">{Math.round(avgProgress)}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STRATEGY_LIST.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="text-[10px] text-[var(--color-text-muted)] text-center">{s.emoji} {s.label}</div>
                  <div className="h-1.5 rounded-full bg-[var(--color-bg-primary)]/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress[s.key]}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        <button onClick={launch} disabled={running}
          className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
        >
          {running ? "Comparaison en cours..." : "Comparer les 3 Strat\u00e9gies"}
        </button>
      </div>

      {/* Results */}
      {results.length === 3 && (
        <>
          {/* Winner badge */}
          {winnerInfo && winner && (
            <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 p-5 text-center animate-fade-in-up">
              <div className="text-3xl mb-2">{winnerInfo.emoji}</div>
              <div className="text-lg font-bold text-yellow-400">
                {winnerInfo.label} remporte la comparaison
              </div>
              <div className="text-2xl font-mono font-bold text-white mt-1">
                {winner.stats.totalReturn >= 0 ? "+" : ""}{winner.stats.totalReturn.toFixed(2)}%
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-2 max-w-md mx-auto">{recommendation}</p>
            </div>
          )}

          {/* Overlaid curves */}
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Courbes Compar\u00e9es</h3>
            <OverlaidChart results={results} />
          </div>

          {/* Comparison table */}
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Tableau Comparatif</h3>
            <ComparisonTable results={results} />
          </div>
        </>
      )}
    </div>
  );
}
