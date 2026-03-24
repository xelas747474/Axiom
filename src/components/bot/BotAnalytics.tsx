"use client";

import { useMemo } from "react";
import { useBot } from "@/lib/bot/context";
import { TRADED_CRYPTOS } from "@/lib/bot/types";
import Card from "@/components/Card";

export default function BotAnalytics() {
  const { history, curve, config, positions } = useBot();

  const stats = useMemo(() => {
    if (history.length === 0) return null;

    const wins = history.filter((t) => t.result === "win");
    const losses = history.filter((t) => t.result === "loss");
    const totalPnl = history.reduce((s, t) => s + t.pnl, 0);
    const sumWins = wins.reduce((s, t) => s + t.pnl, 0);
    const sumLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length > 0 ? sumWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? sumLosses / losses.length : 0;
    const profitFactor = sumLosses > 0 ? sumWins / sumLosses : sumWins > 0 ? Infinity : 0;
    const expectancy = history.length > 0 ? totalPnl / history.length : 0;

    // Max drawdown from curve
    let maxDD = 0;
    let peak = 0;
    for (const p of curve) {
      if (p.v > peak) peak = p.v;
      const dd = peak > 0 ? ((peak - p.v) / peak) * 100 : 0;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe ratio (simplified: daily returns)
    const dailyReturns: number[] = [];
    if (curve.length > 1) {
      const dayMs = 86400000;
      let prevVal = curve[0].v;
      let prevDay = Math.floor(curve[0].t / dayMs);
      for (const p of curve) {
        const day = Math.floor(p.t / dayMs);
        if (day > prevDay) {
          dailyReturns.push((p.v - prevVal) / prevVal);
          prevVal = p.v;
          prevDay = day;
        }
      }
    }
    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
      : 0;
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    // P&L by crypto
    const pnlByCrypto: Record<string, number> = {};
    for (const c of TRADED_CRYPTOS) {
      pnlByCrypto[c.label] = history
        .filter((t) => t.crypto === c.symbol)
        .reduce((s, t) => s + t.pnl, 0);
    }

    // P&L by day of week
    const pnlByDay: number[] = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    for (const t of history) {
      const day = new Date(t.exitTime).getDay();
      pnlByDay[day] += t.pnl;
    }
    const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    // Heatmap: hour x day
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const t of history) {
      const d = new Date(t.exitTime);
      heatmap[d.getDay()][d.getHours()] += t.pnl;
    }

    return { avgWin, avgLoss, profitFactor, expectancy, maxDD, sharpe, pnlByCrypto, pnlByDay, dayLabels, heatmap };
  }, [history, curve]);

  // Allocation donut
  const positionValues = TRADED_CRYPTOS.map((c) => {
    const pos = positions.filter((p) => p.crypto === c.symbol);
    return { label: c.label, value: pos.reduce((s, p) => s + p.size, 0) };
  }).filter((x) => x.value > 0);

  const totalInPositions = positionValues.reduce((s, x) => s + x.value, 0);
  const freeCapital = Math.max(0, config.initialCapital - totalInPositions);
  const allocationSlices = [
    { label: "USDC libre", value: freeCapital, color: "#64748b" },
    ...positionValues.map((x, i) => ({
      ...x,
      color: ["#3b82f6", "#8b5cf6", "#06b6d4"][i] ?? "#94a3b8",
    })),
  ].filter((x) => x.value > 0);
  const totalAllocation = allocationSlices.reduce((s, x) => s + x.value, 0) || 1;

  if (!stats) {
    return (
      <Card className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
        <h3 className="text-sm font-bold text-white mb-3">📊 Analytics</h3>
        <p className="text-xs text-[var(--color-text-muted)] text-center py-8">
          Pas assez de données pour les analytics.
        </p>
      </Card>
    );
  }

  const maxDayPnl = Math.max(...stats.pnlByDay.map(Math.abs), 1);
  const cryptoEntries = Object.entries(stats.pnlByCrypto);
  const maxCryptoPnl = Math.max(...cryptoEntries.map(([, v]) => Math.abs(v)), 1);

  // Heatmap min/max
  const heatFlat = stats.heatmap.flat();
  const heatMin = Math.min(...heatFlat);
  const heatMax = Math.max(...heatFlat);
  const heatRange = Math.max(Math.abs(heatMin), Math.abs(heatMax)) || 1;

  return (
    <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Key Metrics */}
        <Card>
          <h3 className="text-sm font-bold text-white mb-3">📊 Métriques clés</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Sharpe Ratio", value: stats.sharpe.toFixed(2), good: stats.sharpe > 1 },
              { label: "Max Drawdown", value: `${stats.maxDD.toFixed(1)}%`, good: stats.maxDD < 10 },
              { label: "Profit Factor", value: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2), good: stats.profitFactor > 1.5 },
              { label: "Expectancy", value: `$${stats.expectancy.toFixed(2)}`, good: stats.expectancy > 0 },
              { label: "Avg Win", value: `+$${stats.avgWin.toFixed(2)}`, good: true },
              { label: "Avg Loss", value: `-$${stats.avgLoss.toFixed(2)}`, good: false },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-[var(--color-bg-primary)]/50 p-3">
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">{m.label}</p>
                <p className={`text-sm font-bold font-mono tabular-nums mt-1 ${m.good ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Allocation Donut */}
        <Card>
          <h3 className="text-sm font-bold text-white mb-3">🎯 Allocation actuelle</h3>
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">
              {(() => {
                let cumAngle = 0;
                return allocationSlices.map((slice) => {
                  const pct = slice.value / totalAllocation;
                  const startAngle = cumAngle;
                  cumAngle += pct * 360;
                  const endAngle = cumAngle;

                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  const rad1 = ((startAngle - 90) * Math.PI) / 180;
                  const rad2 = ((endAngle - 90) * Math.PI) / 180;
                  const x1 = 50 + 40 * Math.cos(rad1);
                  const y1 = 50 + 40 * Math.sin(rad1);
                  const x2 = 50 + 40 * Math.cos(rad2);
                  const y2 = 50 + 40 * Math.sin(rad2);

                  if (pct >= 0.999) {
                    return <circle key={slice.label} cx={50} cy={50} r={40} fill="none" stroke={slice.color} strokeWidth={12} />;
                  }

                  return (
                    <path
                      key={slice.label}
                      d={`M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={12}
                      strokeLinecap="round"
                    />
                  );
                });
              })()}
            </svg>
            <div className="space-y-2 flex-1">
              {allocationSlices.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[var(--color-text-secondary)]">{s.label}</span>
                  </div>
                  <span className="font-bold font-mono tabular-nums text-white">
                    ${s.value.toFixed(0)} <span className="text-[var(--color-text-muted)] font-normal">({((s.value / totalAllocation) * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* P&L by day */}
        <Card>
          <h3 className="text-sm font-bold text-white mb-3">📅 P&L par jour</h3>
          <div className="flex items-end gap-2 h-24">
            {stats.pnlByDay.map((pnl, i) => {
              const h = Math.abs(pnl) / maxDayPnl;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative h-16 flex items-end justify-center">
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: `${Math.max(2, h * 100)}%`,
                        backgroundColor: pnl >= 0 ? "#22c55e" : "#ef4444",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--color-text-muted)]">{stats.dayLabels[i]}</span>
                  <span className={`text-[9px] font-mono tabular-nums ${pnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* P&L by crypto */}
        <Card>
          <h3 className="text-sm font-bold text-white mb-3">🪙 P&L par crypto</h3>
          <div className="space-y-3">
            {cryptoEntries.map(([label, pnl]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white font-bold">{label}</span>
                  <span className={`font-mono tabular-nums font-bold ${pnl >= 0 ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(Math.abs(pnl) / maxCryptoPnl) * 100}%`,
                      backgroundColor: pnl >= 0 ? "#22c55e" : "#ef4444",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <h3 className="text-sm font-bold text-white mb-3">🔥 Heatmap — Heures profitables</h3>
        <div className="overflow-x-auto -mx-4 sm:-mx-5">
          <div className="min-w-[600px] px-4 sm:px-5">
            <div className="flex gap-0.5">
              <div className="w-8 shrink-0" />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[8px] text-[var(--color-text-muted)]">
                  {h}
                </div>
              ))}
            </div>
            {stats.heatmap.map((row, day) => (
              <div key={day} className="flex gap-0.5 mt-0.5">
                <div className="w-8 shrink-0 text-[9px] text-[var(--color-text-muted)] flex items-center">
                  {stats.dayLabels[day]}
                </div>
                {row.map((val, hour) => {
                  const intensity = val / heatRange;
                  let bg: string;
                  if (val > 0) bg = `rgba(34,197,94,${Math.min(0.8, intensity * 0.8)})`;
                  else if (val < 0) bg = `rgba(239,68,68,${Math.min(0.8, Math.abs(intensity) * 0.8)})`;
                  else bg = "rgba(100,116,139,0.1)";

                  return (
                    <div
                      key={hour}
                      className="flex-1 aspect-square rounded-sm transition-colors duration-300"
                      style={{ backgroundColor: bg }}
                      title={`${stats.dayLabels[day]} ${hour}h: ${val >= 0 ? "+" : ""}$${val.toFixed(2)}`}
                    />
                  );
                })}
              </div>
            ))}
            <div className="flex items-center justify-center gap-4 mt-3 text-[9px] text-[var(--color-text-muted)]">
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-sm bg-[rgba(239,68,68,0.6)]" /> Perte
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-sm bg-[rgba(100,116,139,0.2)]" /> Neutre
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-sm bg-[rgba(34,197,94,0.6)]" /> Profit
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
