"use client";

import { useState, useRef, useCallback } from "react";
import type { BotStrategy } from "@/lib/bot/types";
import { STRATEGIES } from "@/lib/bot/types";

// ============================================
// Backtest Panel — Config form + Web Worker launcher
// ============================================

export interface BacktestConfig {
  crypto: "bitcoin" | "ethereum" | "solana";
  days: 30 | 90 | 180 | 365;
  strategy: BotStrategy;
  initialCapital: number;
  allocations: { BTCUSDT: number; ETHUSDT: number; SOLUSDT: number };
}

export interface BacktestTrade {
  id: number;
  crypto: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  size: number;
  pnl: number;
  pnlPct: number;
  result: "win" | "loss";
  closeReason: string;
}

export interface BacktestStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  totalReturn: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgDuration: number;
  winStreak: number;
  loseStreak: number;
  expectedValue: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  stats: BacktestStats;
  trades: BacktestTrade[];
  curve: { t: number; v: number }[];
}

const PERIODS: { label: string; value: 30 | 90 | 180 | 365 }[] = [
  { label: "30j", value: 30 },
  { label: "90j", value: 90 },
  { label: "180j", value: 180 },
  { label: "1 an", value: 365 },
];

const CRYPTOS: { id: "bitcoin" | "ethereum" | "solana"; label: string; symbol: string }[] = [
  { id: "bitcoin", label: "BTC", symbol: "BTCUSDT" },
  { id: "ethereum", label: "ETH", symbol: "ETHUSDT" },
  { id: "solana", label: "SOL", symbol: "SOLUSDT" },
];

const STRATEGY_LIST: { key: BotStrategy; emoji: string; label: string; desc: string }[] = [
  { key: "conservative", emoji: "\u{1F6E1}\uFE0F", label: "Conservateur", desc: "SL 1.5% / TP 2.5%" },
  { key: "balanced", emoji: "\u2696\uFE0F", label: "Equilibr\u00e9", desc: "SL 2.5% / TP 4%" },
  { key: "aggressive", emoji: "\u{1F525}", label: "Agressif", desc: "SL 4% / TP 6%" },
];

interface Props {
  onResult: (result: BacktestResult) => void;
  onRunning: (running: boolean) => void;
}

export default function BacktestPanel({ onResult, onRunning }: Props) {
  const [crypto, setCrypto] = useState<"bitcoin" | "ethereum" | "solana">("bitcoin");
  const [days, setDays] = useState<30 | 90 | 180 | 365>(90);
  const [strategy, setStrategy] = useState<BotStrategy>("balanced");
  const [capital, setCapital] = useState(10000);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const launch = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setError(null);
    onRunning(true);

    try {
      // Fetch OHLCV data
      const res = await fetch(`/api/market/ohlcv?crypto=${crypto}&days=${days}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors du chargement des donn\u00e9es");
      }
      const ohlcv = await res.json();

      if (!ohlcv.data || ohlcv.data.length < 10) {
        throw new Error("Donn\u00e9es insuffisantes pour le backtest");
      }

      // Terminate any previous worker
      workerRef.current?.terminate();

      const worker = new Worker("/workers/backtest-worker.js");
      workerRef.current = worker;

      const strat = STRATEGIES[strategy];

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setProgress(msg.progress);
        } else if (msg.type === "complete") {
          const result: BacktestResult = {
            config: { crypto, days, strategy, initialCapital: capital, allocations: { BTCUSDT: 50, ETHUSDT: 30, SOLUSDT: 20 } },
            stats: msg.result.stats,
            trades: msg.result.trades,
            curve: msg.result.curve,
          };
          onResult(result);
          setRunning(false);
          setProgress(100);
          onRunning(false);
          worker.terminate();
        } else if (msg.type === "error") {
          setError(msg.error);
          setRunning(false);
          onRunning(false);
          worker.terminate();
        }
      };

      worker.onerror = () => {
        setError("Erreur du worker de backtest");
        setRunning(false);
        onRunning(false);
      };

      worker.postMessage({
        type: "run",
        ohlcData: ohlcv.data,
        config: {
          strategy,
          initialCapital: capital,
          stopLossPct: strat.stopLossPct,
          takeProfitPct: strat.takeProfitPct,
          scoreThreshold: strat.scoreThreshold,
          positionSizePct: strat.positionSizePct,
          trailingStop: true,
          maxDrawdownPct: 15,
          cooldownBars: 3,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setRunning(false);
      onRunning(false);
    }
  }, [crypto, days, strategy, capital, onResult, onRunning]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Period selector */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          P\u00e9riode
        </label>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              disabled={running}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                days === p.value
                  ? "bg-[var(--color-accent-blue)] text-white shadow-lg shadow-[var(--color-accent-blue)]/25"
                  : "bg-[var(--color-bg-primary)]/60 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-primary)]"
              } disabled:opacity-50`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Crypto selector */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Crypto
        </label>
        <div className="flex gap-2">
          {CRYPTOS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCrypto(c.id)}
              disabled={running}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                crypto === c.id
                  ? "bg-[var(--color-accent-blue)] text-white shadow-lg shadow-[var(--color-accent-blue)]/25"
                  : "bg-[var(--color-bg-primary)]/60 text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-primary)]"
              } disabled:opacity-50`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategy cards */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Strat\u00e9gie
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STRATEGY_LIST.map((s) => (
            <button
              key={s.key}
              onClick={() => setStrategy(s.key)}
              disabled={running}
              className={`rounded-xl p-3 text-center transition-all duration-300 border ${
                strategy === s.key
                  ? "border-[var(--color-accent-blue)]/50 bg-[var(--color-accent-blue)]/10 shadow-lg shadow-[var(--color-accent-blue)]/10"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/40 hover:border-[var(--color-border-subtle)]/80"
              } disabled:opacity-50`}
            >
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-xs font-semibold text-white">{s.label}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Capital input */}
      <div>
        <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
          Capital initial (USDC)
        </label>
        <input
          type="number"
          value={capital}
          onChange={(e) => setCapital(Math.max(100, Number(e.target.value)))}
          disabled={running}
          className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/60 px-4 py-2.5 text-sm font-mono text-white outline-none focus:border-[var(--color-accent-blue)]/50 transition-colors disabled:opacity-50"
          min={100}
          step={100}
        />
      </div>

      {/* Progress bar */}
      {running && (
        <div className="space-y-1.5 animate-fade-in-up">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Backtest en cours...</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-bg-primary)]/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-blue)] to-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 animate-fade-in-up">
          {error}
        </div>
      )}

      {/* Launch button */}
      <button
        onClick={launch}
        disabled={running}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent-blue)] to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--color-accent-blue)]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[var(--color-accent-blue)]/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
      >
        {running ? "Backtest en cours..." : "Lancer le Backtest"}
      </button>
    </div>
  );
}
