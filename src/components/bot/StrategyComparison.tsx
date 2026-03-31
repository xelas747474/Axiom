"use client";

import { useState, useCallback, useRef } from "react";
import { STRATEGIES } from "@/lib/bot/types";
import type { BotStrategy } from "@/lib/bot/types";
import type { BacktestResult, BacktestStats } from "./BacktestPanel";
import { runBacktestAsync } from "@/lib/backtest-engine";

// ============================================
// Strategy Comparison — 3 sequential backtests, winner display, comparison table, overlaid curves
// ============================================

const STRATEGY_LIST: { key: BotStrategy; emoji: string; label: string; color: string }[] = [
  { key: "conservative", emoji: "🛡️", label: "Conservateur", color: "#3b82f6" },
  { key: "balanced", emoji: "⚖️", label: "Équilibré", color: "#a855f7" },
  { key: "aggressive", emoji: "🔥", label: "Agressif", color: "#f59e0b" },
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

const CRYPTO_LABELS: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

const TIMEOUT_MS = 30_000;

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
        const s = STRATEGY_LIST.find((st) => st.key === r.config.strategy);
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
    { label: "Profit Factor", key: "profitFactor", format: (v) => v === Infinity ? "∞" : v.toFixed(2), higherBetter: true },
    { label: "Sharpe Ratio", key: "sharpeRatio", format: (v) => v.toFixed(2), higherBetter: true },
    { label: "Max Drawdown", key: "maxDrawdown", format: (v) => `${v.toFixed(2)}%`, higherBetter: false },
    { label: "Gain Moyen", key: "avgWin", format: (v) => `${v.toFixed(2)}%`, higherBetter: true },
    { label: "Perte Moyenne", key: "avgLoss", format: (v) => `${v.toFixed(2)}%`, higherBetter: false },
    { label: "Espérance", key: "expectedValue", format: (v) => `$${v.toFixed(2)}`, higherBetter: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)]">
            <th className="text-left py-2 px-3 text-[var(--color-text-muted)] font-normal uppercase tracking-wider">Métrique</th>
            {results.map((r) => {
              const s = STRATEGY_LIST.find((st) => st.key === r.config.strategy);
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
                      {m.format(val)} {isBest && "🏆"}
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
  const abortRef = useRef(false);

  const launch = useCallback(async () => {
    setRunning(true);
    setResults([]);
    setError(null);
    setProgress({ conservative: 0, balanced: 0, aggressive: 0 });
    abortRef.current = false;

    const timeoutId = setTimeout(() => {
      abortRef.current = true;
      setError("Backtest échoué — réessayez (timeout 30s)");
      setRunning(false);
    }, TIMEOUT_MS);

    try {
      const symbol = CRYPTO_LABELS[crypto] || "BTC";
      const res = await fetch(`/api/market/ohlcv?symbol=${symbol}&days=${days}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des données OHLCV");
      const ohlcv = await res.json();
      if (!ohlcv.data || !Array.isArray(ohlcv.data) || ohlcv.data.length < 10) {
        throw new Error("Données insuffisantes pour le backtest");
      }

      if (abortRef.current) return;

      const completed: BacktestResult[] = [];

      // Run 3 backtests sequentially to avoid blocking the UI
      for (const strat of STRATEGY_LIST) {
        if (abortRef.current) return;

        const stratConfig = STRATEGIES[strat.key];

        const engineResult = await runBacktestAsync(
          ohlcv.data,
          {
            strategy: strat.key,
            initialCapital: capital,
            stopLossPct: stratConfig.stopLossPct,
            takeProfitPct: stratConfig.takeProfitPct,
            scoreThreshold: stratConfig.scoreThreshold,
            positionSizePct: stratConfig.positionSizePct,
            trailingStop: true,
            maxDrawdownPct: 15,
            cooldownBars: 3,
            cryptoLabel: CRYPTO_LABELS[crypto] || "BTC",
          },
          (pct) => {
            if (!abortRef.current) {
              setProgress((prev) => ({ ...prev, [strat.key]: pct }));
            }
          }
        );

        if (abortRef.current) return;

        completed.push({
          config: { crypto, days, strategy: strat.key, initialCapital: capital, allocations: { BTCUSDT: 50, ETHUSDT: 30, SOLUSDT: 20 } },
          stats: engineResult.stats,
          trades: engineResult.trades,
          curve: engineResult.curve,
        });
      }

      clearTimeout(timeoutId);
      setResults(completed);
      setRunning(false);
    } catch (err) {
      clearTimeout(timeoutId);
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        setRunning(false);
      }
    }
  }, [crypto, days, capital]);

  const winner = results.length === 3
    ? results.reduce((best, r) => (r.stats.totalReturn > best.stats.totalReturn ? r : best))
    : null;
  const winnerInfo = winner ? STRATEGY_LIST.find((s) => s.key === winner.config.strategy) : null;

  const avgProgress = (progress.conservative + progress.balanced + progress.aggressive) / 3;

  const recommendation = winner
    ? winner.stats.totalReturn > 5
      ? `La stratégie ${winnerInfo?.label} offre le meilleur rendement avec un Sharpe de ${winner.stats.sharpeRatio.toFixed(2)}. Recommandée pour cette période.`
      : winner.stats.totalReturn > 0
        ? `Rendements modestes. La stratégie ${winnerInfo?.label} performe légèrement mieux, mais les conditions de marché limitent les gains.`
        : `Marché défavorable. Aucune stratégie ne génère de profit. Considérez de rester en dehors du marché.`
    : "";

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Config */}
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">Configuration de la Comparaison</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">Période</label>
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
          {running ? "Comparaison en cours..." : "Comparer les 3 Stratégies"}
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
            <h3 className="text-sm font-semibold text-white mb-3">Courbes Comparées</h3>
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
