"use client";

import { useState } from "react";
import Card from "./Card";
import { btcChartData } from "@/data/mock";

const timeframes = ["1H", "1D", "1W", "1M", "1Y"] as const;
type Timeframe = (typeof timeframes)[number];

export default function ChartContainer() {
  const [active, setActive] = useState<Timeframe>("1W");
  const data = btcChartData[active];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate SVG path for the chart
  const width = 800;
  const height = 200;
  const padding = 10;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y =
      height -
      padding -
      ((value - min) / range) * (height - 2 * padding);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const isPositive = data[data.length - 1] >= data[0];
  const color = isPositive ? "var(--color-positive)" : "var(--color-negative)";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Bitcoin (BTC)</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            ${data[data.length - 1].toLocaleString()}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[var(--color-bg-primary)] p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActive(tf)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active === tf
                  ? "bg-[var(--color-accent-blue)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
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
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGradient)" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill={color}
            opacity={i === points.length - 1 ? 1 : 0}
          />
        ))}
      </svg>
    </Card>
  );
}
