"use client";

import { useState } from "react";
import type { AISignalResult, CategoryScore } from "@/lib/indicators/types";

const signalColors: Record<string, string> = {
  STRONG_BUY: "#22c55e",
  BUY: "#4ade80",
  NEUTRAL: "#64748b",
  SELL: "#f87171",
  STRONG_SELL: "#ef4444",
};

const signalLabels: Record<string, string> = {
  STRONG_BUY: "STRONG BUY",
  BUY: "BUY",
  NEUTRAL: "NEUTRAL",
  SELL: "SELL",
  STRONG_SELL: "STRONG SELL",
};

const signalBg: Record<string, string> = {
  STRONG_BUY: "rgba(34,197,94,0.12)",
  BUY: "rgba(74,222,128,0.1)",
  NEUTRAL: "rgba(100,116,139,0.1)",
  SELL: "rgba(248,113,113,0.1)",
  STRONG_SELL: "rgba(239,68,68,0.12)",
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(6)}`;
}

// Gauge SVG component
function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const normalizedScore = (score + 100) / 200; // 0 to 1
  const angle = -135 + normalizedScore * 270; // -135 to +135 degrees
  const radius = size / 2 - 20;
  const cx = size / 2;
  const cy = size / 2;

  // Arc path for background
  const arcStart = -135;
  const arcEnd = 135;
  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const bgStart = polarToCartesian(cx, cy, radius, arcStart);
  const bgEnd = polarToCartesian(cx, cy, radius, arcEnd);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

  // Filled arc
  const fillEnd = polarToCartesian(cx, cy, radius, angle);
  const largeArc = angle - arcStart > 180 ? 1 : 0;
  const fillPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`;

  // Gradient color based on score
  function getColor(s: number): string {
    if (s > 50) return "#22c55e";
    if (s > 15) return "#4ade80";
    if (s > -15) return "#f59e0b";
    if (s > -50) return "#f87171";
    return "#ef4444";
  }

  // Needle
  const needleEnd = polarToCartesian(cx, cy, radius - 15, angle);

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.75}`} className="mx-auto">
      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="rgba(42, 48, 80, 0.5)" strokeWidth="12" strokeLinecap="round" />

      {/* Colored arc */}
      <path d={fillPath} fill="none" stroke={getColor(score)} strokeWidth="12" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${getColor(score)}40)`, transition: "all 0.8s ease" }} />

      {/* Tick marks */}
      {[-100, -50, 0, 50, 100].map((tick) => {
        const tickAngle = -135 + ((tick + 100) / 200) * 270;
        const inner = polarToCartesian(cx, cy, radius + 8, tickAngle);
        const outer = polarToCartesian(cx, cy, radius + 14, tickAngle);
        return (
          <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke="#64748b" strokeWidth="1.5" />
        );
      })}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
        stroke="white" strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: "all 0.8s ease", filter: "drop-shadow(0 0 4px rgba(255,255,255,0.3))" }} />
      <circle cx={cx} cy={cy} r="5" fill="white" />

      {/* Score text */}
      <text x={cx} y={cy + 28} textAnchor="middle" fill="white" fontSize="28" fontWeight="bold"
        fontFamily="'JetBrains Mono', monospace">
        {score > 0 ? "+" : ""}{score}
      </text>
    </svg>
  );
}

// Category bar
function CategoryBar({ category }: { category: CategoryScore }) {
  const [expanded, setExpanded] = useState(false);
  const pct = (category.score + 100) / 2;

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left group">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text-secondary)] group-hover:text-white transition-colors">
            {category.category} ({(category.weight * 100).toFixed(0)}%)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tabular-nums" style={{ color: signalColors[category.signal] }}>
              {category.score > 0 ? "+" : ""}{category.score}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="#64748b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-bg-primary)] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)` }} />
        </div>
      </button>

      {expanded && (
        <div className="pl-2 space-y-1.5 animate-fade-in">
          {category.indicators.map((ind) => (
            <div key={ind.name} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-[var(--color-bg-primary)]/30">
              <div>
                <span className="text-[var(--color-text-muted)]">{ind.name}</span>
                <p className="text-[10px] text-[var(--color-text-muted)]/60 mt-0.5 max-w-[200px] truncate">{ind.description}</p>
              </div>
              <span className="font-bold tabular-nums shrink-0 ml-2" style={{ color: signalColors[ind.signal] }}>
                {ind.score > 0 ? "+" : ""}{ind.score}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AISignalPanel({ signal }: { signal: AISignalResult }) {
  return (
    <div className="space-y-6">
      {/* Main signal */}
      <div className="text-center">
        <ScoreGauge score={signal.globalScore} />
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2"
          style={{ background: signalBg[signal.signal] }}>
          <span className="h-2.5 w-2.5 rounded-full animate-live-pulse" style={{ backgroundColor: signalColors[signal.signal] }} />
          <span className="text-sm font-bold tracking-wider" style={{ color: signalColors[signal.signal] }}>
            {signalLabels[signal.signal]}
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Confiance: <span className="text-white font-semibold">{signal.confidence}%</span>
        </p>
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Breakdown</h4>
        {signal.categories.map((cat) => (
          <CategoryBar key={cat.category} category={cat} />
        ))}
      </div>

      {/* Entry/SL/TP */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[var(--color-bg-primary)]/50 p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Entrée</p>
          <p className="text-xs font-bold text-white tabular-nums mt-1">{formatPrice(signal.entryPrice)}</p>
        </div>
        <div className="rounded-xl bg-[var(--color-negative)]/10 p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Stop Loss</p>
          <p className="text-xs font-bold text-[var(--color-negative)] tabular-nums mt-1">{formatPrice(signal.stopLoss)}</p>
        </div>
        <div className="rounded-xl bg-[var(--color-positive)]/10 p-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Take Profit</p>
          <p className="text-xs font-bold text-[var(--color-positive)] tabular-nums mt-1">{formatPrice(signal.takeProfit)}</p>
        </div>
      </div>

      {/* Bullish / Bearish reasons */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-[var(--color-positive)] uppercase tracking-wider flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-positive)]" />
            Arguments haussiers
          </h4>
          {signal.bullishReasons.map((reason, i) => (
            <p key={i} className="text-[11px] text-[var(--color-text-secondary)] pl-3 border-l border-[var(--color-positive)]/30">
              {reason}
            </p>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-[var(--color-negative)] uppercase tracking-wider flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-negative)]" />
            Arguments baissiers
          </h4>
          {signal.bearishReasons.map((reason, i) => (
            <p key={i} className="text-[11px] text-[var(--color-text-secondary)] pl-3 border-l border-[var(--color-negative)]/30">
              {reason}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
