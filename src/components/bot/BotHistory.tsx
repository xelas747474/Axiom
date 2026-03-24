"use client";

import { useState, useMemo } from "react";
import { useBot } from "@/lib/bot/context";
import { TRADED_CRYPTOS, type TradedCrypto, type TradeCloseReason } from "@/lib/bot/types";
import Card from "@/components/Card";

const CLOSE_REASON_LABELS: Record<TradeCloseReason, { text: string; color: string }> = {
  take_profit: { text: "Take Profit atteint", color: "#22c55e" },
  stop_loss: { text: "Stop Loss touché", color: "#ef4444" },
  trailing_stop: { text: "Trailing Stop déclenché", color: "#f59e0b" },
  signal_reversed: { text: "Signal IA inversé", color: "#3b82f6" },
  manual: { text: "Fermé manuellement", color: "#94a3b8" },
  max_drawdown: { text: "Max drawdown atteint", color: "#991b1b" },
};

function fmt(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

type FilterCrypto = "all" | TradedCrypto;
type FilterResult = "all" | "win" | "loss";
type FilterPeriod = "today" | "7d" | "30d" | "all";

export default function BotHistory() {
  const { history } = useBot();
  const [filterCrypto, setFilterCrypto] = useState<FilterCrypto>("all");
  const [filterResult, setFilterResult] = useState<FilterResult>("all");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    return history
      .filter((t) => {
        if (filterCrypto !== "all" && t.crypto !== filterCrypto) return false;
        if (filterResult !== "all" && t.result !== filterResult) return false;
        if (filterPeriod === "today" && t.exitTime < new Date().setHours(0, 0, 0, 0)) return false;
        if (filterPeriod === "7d" && t.exitTime < now - 7 * 86400000) return false;
        if (filterPeriod === "30d" && t.exitTime < now - 30 * 86400000) return false;
        return true;
      })
      .sort((a, b) => b.exitTime - a.exitTime);
  }, [history, filterCrypto, filterResult, filterPeriod]);

  // Stats
  const totalTrades = filtered.length;
  const wins = filtered.filter((t) => t.result === "win").length;
  const losses = totalTrades - wins;
  const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const biggestWin = filtered.filter((t) => t.result === "win").sort((a, b) => b.pnl - a.pnl)[0];
  const biggestLoss = filtered.filter((t) => t.result === "loss").sort((a, b) => a.pnl - b.pnl)[0];

  // Current streak
  let currentStreak = 0;
  let streakType: "win" | "loss" | null = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (streakType === null) {
      streakType = history[i].result;
      currentStreak = 1;
    } else if (history[i].result === streakType) {
      currentStreak++;
    } else break;
  }

  // Best win streak
  let bestStreak = 0;
  let cur = 0;
  for (const t of history) {
    if (t.result === "win") { cur++; if (cur > bestStreak) bestStreak = cur; }
    else cur = 0;
  }

  const btnCls = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
      active
        ? "bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)]/30"
        : "text-[var(--color-text-muted)] hover:text-white border border-transparent"
    }`;

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
      <h3 className="text-sm font-bold text-white mb-3">📜 Historique des trades</h3>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
        <div className="rounded-xl bg-[var(--color-bg-primary)]/50 p-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">Total</p>
          <p className="text-sm font-bold text-white font-mono">{totalTrades}</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-primary)]/50 p-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">W/L</p>
          <p className="text-sm font-bold font-mono">
            <span className="text-[var(--color-positive)]">{wins}</span>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-[var(--color-negative)]">{losses}</span>
            <span className="text-[var(--color-text-muted)] text-[10px] ml-1">
              ({totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0}%)
            </span>
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-primary)]/50 p-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">Profit total</p>
          <p className={`text-sm font-bold font-mono tabular-nums ${totalPnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-primary)]/50 p-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">Streak</p>
          <p className="text-sm font-bold text-white font-mono">
            {currentStreak} {streakType === "win" ? "✅" : streakType === "loss" ? "❌" : ""}
            <span className="text-[10px] text-[var(--color-text-muted)] ml-1">max {bestStreak}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(["all", "BTCUSDT", "ETHUSDT", "SOLUSDT"] as FilterCrypto[]).map((v) => (
          <button key={v} onClick={() => setFilterCrypto(v)} className={btnCls(filterCrypto === v)}>
            {v === "all" ? "All" : TRADED_CRYPTOS.find((c) => c.symbol === v)?.label}
          </button>
        ))}
        <span className="mx-1 border-l border-[var(--color-border-subtle)]" />
        {(["all", "win", "loss"] as FilterResult[]).map((v) => (
          <button key={v} onClick={() => setFilterResult(v)} className={btnCls(filterResult === v)}>
            {v === "all" ? "All" : v === "win" ? "Wins" : "Losses"}
          </button>
        ))}
        <span className="mx-1 border-l border-[var(--color-border-subtle)]" />
        {(["today", "7d", "30d", "all"] as FilterPeriod[]).map((v) => (
          <button key={v} onClick={() => setFilterPeriod(v)} className={btnCls(filterPeriod === v)}>
            {v === "today" ? "Aujourd'hui" : v === "all" ? "Tout" : v}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4 sm:-mx-5 max-h-[400px] overflow-y-auto">
        <table className="w-full min-w-[750px] text-xs">
          <thead className="sticky top-0 bg-[var(--color-bg-card)]">
            <tr className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-2 py-2">Date</th>
              <th className="text-left px-2 py-2">Crypto</th>
              <th className="text-left px-2 py-2">Dir.</th>
              <th className="text-right px-2 py-2">Entrée</th>
              <th className="text-right px-2 py-2">Sortie</th>
              <th className="text-right px-2 py-2">P&L</th>
              <th className="text-center px-2 py-2">Résultat</th>
              <th className="text-right px-2 py-2">Durée</th>
              <th className="text-left px-4 py-2">Raison</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map((trade) => {
              const label = TRADED_CRYPTOS.find((c) => c.symbol === trade.crypto)?.label ?? trade.crypto;
              const reason = CLOSE_REASON_LABELS[trade.closeReason];
              const d = new Date(trade.exitTime);
              const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

              return (
                <tr key={trade.id} className="border-t border-[var(--color-border-subtle)]/20 hover:bg-[var(--color-bg-card-hover)]/30 transition-colors">
                  <td className="px-4 py-2 text-[var(--color-text-muted)] font-mono">{trade.tradeNumber}</td>
                  <td className="px-2 py-2 text-[var(--color-text-secondary)] font-mono tabular-nums">{dateStr}</td>
                  <td className="px-2 py-2 font-bold text-white">{label}</td>
                  <td className="px-2 py-2">
                    <span className={trade.direction === "LONG" ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}>
                      {trade.direction === "LONG" ? "🟢" : "🔴"} {trade.direction}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-white font-mono tabular-nums">{fmt(trade.entryPrice)}</td>
                  <td className="px-2 py-2 text-right text-white font-mono tabular-nums">{fmt(trade.exitPrice)}</td>
                  <td className={`px-2 py-2 text-right font-bold font-mono tabular-nums ${trade.result === "win" ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                    {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {trade.result === "win" ? "✅" : "❌"}
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--color-text-muted)] font-mono tabular-nums">
                    {formatDuration(trade.exitTime - trade.entryTime)}
                  </td>
                  <td className="px-4 py-2 text-[11px]" style={{ color: reason.color }}>
                    {reason.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-xs text-[var(--color-text-muted)] py-8">Aucun trade</p>
        )}
      </div>
    </Card>
  );
}
