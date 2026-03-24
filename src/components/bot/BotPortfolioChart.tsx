"use client";

import { useState, useMemo } from "react";
import { useBot } from "@/lib/bot/context";
import Card from "@/components/Card";

type ChartPeriod = "today" | "7d" | "30d" | "all";

export default function BotPortfolioChart() {
  const { curve, config, history } = useBot();
  const [period, setPeriod] = useState<ChartPeriod>("all");

  const filteredCurve = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (period === "today") cutoff = new Date().setHours(0, 0, 0, 0);
    else if (period === "7d") cutoff = now - 7 * 86400000;
    else if (period === "30d") cutoff = now - 30 * 86400000;
    return curve.filter((p) => p.t >= cutoff);
  }, [curve, period]);

  // Closed trades as markers
  const markers = useMemo(() => {
    const now = Date.now();
    let cutoff = 0;
    if (period === "today") cutoff = new Date().setHours(0, 0, 0, 0);
    else if (period === "7d") cutoff = now - 7 * 86400000;
    else if (period === "30d") cutoff = now - 30 * 86400000;
    return history.filter((t) => t.exitTime >= cutoff);
  }, [history, period]);

  if (filteredCurve.length < 2) {
    return (
      <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
        <h3 className="text-sm font-bold text-white mb-3">📈 Évolution du portfolio</h3>
        <p className="text-xs text-[var(--color-text-muted)] text-center py-12">
          Pas assez de données. Le bot doit tourner pour générer la courbe.
        </p>
      </Card>
    );
  }

  const values = filteredCurve.map((p) => p.v);
  const minV = Math.min(...values, config.initialCapital * 0.95);
  const maxV = Math.max(...values, config.initialCapital * 1.05);
  const rangeV = maxV - minV || 1;

  const W = 800;
  const H = 200;
  const pad = { top: 10, bottom: 20, left: 0, right: 0 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const tMin = filteredCurve[0].t;
  const tMax = filteredCurve[filteredCurve.length - 1].t;
  const tRange = tMax - tMin || 1;

  function toX(t: number) { return pad.left + ((t - tMin) / tRange) * chartW; }
  function toY(v: number) { return pad.top + chartH - ((v - minV) / rangeV) * chartH; }

  const initialY = toY(config.initialCapital);

  // Build area paths
  const linePoints = filteredCurve.map((p) => `${toX(p.t)},${toY(p.v)}`).join(" ");

  // Green area (above initial) and red area (below initial)
  const areaAbove: string[] = [];
  const areaBelow: string[] = [];

  // Simplified: draw two filled areas using clip paths
  const polyAbove = filteredCurve.map((p) => {
    const y = Math.min(toY(p.v), initialY);
    return `${toX(p.t)},${y}`;
  }).join(" ");

  const polyBelow = filteredCurve.map((p) => {
    const y = Math.max(toY(p.v), initialY);
    return `${toX(p.t)},${y}`;
  }).join(" ");

  // Start/end for area closing
  const firstX = toX(filteredCurve[0].t);
  const lastX = toX(filteredCurve[filteredCurve.length - 1].t);

  const btnCls = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
      active
        ? "bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)]"
        : "text-[var(--color-text-muted)] hover:text-white"
    }`;

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">📈 Évolution du portfolio</h3>
        <div className="flex gap-1">
          {(["today", "7d", "30d", "all"] as ChartPeriod[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={btnCls(period === p)}>
              {p === "today" ? "Aujourd'hui" : p === "all" ? "Tout" : p}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Reference line at initial capital */}
        <line
          x1={pad.left} y1={initialY} x2={W - pad.right} y2={initialY}
          stroke="#64748b" strokeWidth="0.5" strokeDasharray="4,4" opacity={0.5}
        />
        <text x={W - pad.right - 2} y={initialY - 4} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="monospace">
          ${config.initialCapital.toLocaleString()}
        </text>

        {/* Green area above initial */}
        <polygon
          points={`${firstX},${initialY} ${filteredCurve.map((p) => `${toX(p.t)},${Math.min(toY(p.v), initialY)}`).join(" ")} ${lastX},${initialY}`}
          fill="rgba(34,197,94,0.12)"
        />

        {/* Red area below initial */}
        <polygon
          points={`${firstX},${initialY} ${filteredCurve.map((p) => `${toX(p.t)},${Math.max(toY(p.v), initialY)}`).join(" ")} ${lastX},${initialY}`}
          fill="rgba(239,68,68,0.12)"
        />

        {/* Main line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="animate-draw-line"
        />

        {/* Trade markers */}
        {markers.slice(-30).map((trade) => {
          // Find nearest curve point
          const nearest = filteredCurve.reduce((best, p) =>
            Math.abs(p.t - trade.exitTime) < Math.abs(best.t - trade.exitTime) ? p : best,
            filteredCurve[0]
          );
          const x = toX(nearest.t);
          const y = toY(nearest.v);
          const isWin = trade.result === "win";

          return (
            <circle
              key={trade.id}
              cx={x}
              cy={y}
              r="3"
              fill={isWin ? "#22c55e" : "#ef4444"}
              opacity={0.8}
            />
          );
        })}

        {/* Current value label */}
        {filteredCurve.length > 0 && (
          <text
            x={lastX}
            y={toY(filteredCurve[filteredCurve.length - 1].v) - 8}
            textAnchor="end"
            fill="white"
            fontSize="10"
            fontWeight="bold"
            fontFamily="'JetBrains Mono', monospace"
          >
            ${filteredCurve[filteredCurve.length - 1].v.toFixed(2)}
          </text>
        )}
      </svg>
    </Card>
  );
}
