"use client";

import { useState } from "react";
import Card from "./Card";

const timeframes = ["1H", "1D", "1W", "1M", "1Y"] as const;
type Timeframe = (typeof timeframes)[number];

interface ChartContainerProps {
  data?: Record<string, number[]>;
  title?: string;
  symbol?: string;
  currentPrice?: number;
}

export default function ChartContainer({
  data,
  title = "Bitcoin (BTC)",
  symbol: _symbol,
  currentPrice,
}: ChartContainerProps) {
  const [active, setActive] = useState<Timeframe>("1W");

  const defaultData: Record<string, number[]> = {
    "1H": [67500, 67600, 67450, 67700, 67650, 67800, 67750, 67842],
    "1D": [66800, 67100, 66900, 67400, 67200, 67600, 67500, 67842],
    "1W": [64000, 65200, 64800, 66500, 65900, 67200, 66800, 67842],
    "1M": [58000, 60500, 59000, 63000, 61500, 65000, 64000, 67842],
    "1Y": [28000, 35000, 42000, 38000, 45000, 52000, 60000, 67842],
  };

  const chartData = (data ?? defaultData)[active] ?? defaultData[active];
  const displayPrice = currentPrice ?? chartData[chartData.length - 1];

  const min = Math.min(...chartData);
  const max = Math.max(...chartData);
  const range = max - min || 1;

  const width = 800;
  const height = 200;
  const padding = 10;

  const points = chartData.map((value, index) => {
    const x = padding + (index / (chartData.length - 1)) * (width - 2 * padding);
    const y =
      height - padding - ((value - min) / range) * (height - 2 * padding);
    return { x, y };
  });

  // Smooth curve using cubic bezier
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const isPositive = chartData[chartData.length - 1] >= chartData[0];
  const color = isPositive ? "var(--color-positive)" : "var(--color-negative)";
  const changePercent = (
    ((chartData[chartData.length - 1] - chartData[0]) / chartData[0]) *
    100
  ).toFixed(2);

  return (
    <Card className="animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-2xl font-bold text-white tabular-nums">
              ${displayPrice.toLocaleString()}
            </p>
            <span
              className={`text-sm font-semibold ${isPositive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}
            >
              {isPositive ? "+" : ""}
              {changePercent}%
            </span>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-[var(--color-bg-primary)] p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActive(tf)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                active === tf
                  ? "bg-[var(--color-accent-blue)] text-white shadow-md shadow-[var(--color-accent-blue)]/25"
                  : "text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-card)]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="80%" stopColor={color} stopOpacity="0.02" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={padding}
            y1={padding + pct * (height - 2 * padding)}
            x2={width - padding}
            y2={padding + pct * (height - 2 * padding)}
            stroke="var(--color-border-subtle)"
            strokeWidth="0.5"
            strokeDasharray="4 4"
            opacity="0.3"
          />
        ))}

        <path d={areaPath} fill="url(#chartGradient)" className="animate-fade-in" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line"
          filter="url(#glow)"
        />

        {/* Last point with pulse */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="6"
          fill={color}
          opacity="0.2"
          className="animate-live-pulse"
        />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3.5"
          fill={color}
          stroke="var(--color-bg-card)"
          strokeWidth="2"
        />
      </svg>
    </Card>
  );
}
