"use client";

import { useState, useRef, useCallback } from "react";
import Card from "./Card";

const timeframes = ["1H", "1D", "1W", "1M", "1Y"] as const;
type Timeframe = (typeof timeframes)[number];

interface ChartContainerProps {
  data?: Record<string, number[]>;
  title?: string;
  currentPrice?: number;
}

// Format price for axis labels
function formatPrice(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// Format price for tooltip
function formatPriceFull(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ChartContainer({
  data,
  title = "Bitcoin (BTC)",
  currentPrice,
}: ChartContainerProps) {
  const [active, setActive] = useState<Timeframe>("1W");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const defaultData: Record<string, number[]> = {
    "1H": [67500, 67550, 67600, 67580, 67450, 67520, 67700, 67650, 67680, 67800, 67750, 67842],
    "1D": [66800, 66950, 67100, 67050, 66900, 67000, 67200, 67400, 67350, 67200, 67300, 67600, 67500, 67450, 67550, 67650, 67700, 67600, 67700, 67750, 67800, 67780, 67820, 67842],
    "1W": [64000, 64300, 64600, 65200, 65000, 64800, 65100, 65400, 65800, 66200, 66500, 66300, 65900, 66100, 66400, 66700, 67000, 67200, 67100, 66800, 66900, 67100, 67300, 67500, 67400, 67300, 67500, 67600, 67700, 67842],
    "1M": [58000, 58500, 59200, 60500, 60000, 59000, 59500, 60200, 61000, 61800, 63000, 62500, 61500, 62000, 62800, 63500, 64200, 65000, 64500, 64000, 64800, 65500, 66200, 66800, 67000, 67200, 67500, 67842],
    "1Y": [28000, 30000, 32000, 35000, 33000, 37000, 42000, 40000, 38000, 41000, 43000, 45000, 44000, 47000, 49000, 52000, 50000, 53000, 55000, 57000, 60000, 62000, 64000, 66000, 67842],
  };

  const chartData = (data ?? defaultData)[active] ?? defaultData[active];
  const displayPrice = currentPrice ?? chartData[chartData.length - 1];

  // Chart dimensions
  const width = 900;
  const height = 340;
  const paddingLeft = 65;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Price range with padding
  const dataMin = Math.min(...chartData);
  const dataMax = Math.max(...chartData);
  const priceRange = dataMax - dataMin || 1;
  const min = dataMin - priceRange * 0.05;
  const max = dataMax + priceRange * 0.05;
  const range = max - min;

  // Generate nice Y-axis ticks
  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(min + (range / tickCount) * i);
  }

  // Plot points
  const points = chartData.map((value, index) => {
    const x = paddingLeft + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value };
  });

  // Smooth cubic bezier path
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const tension = 0.3;
    const cpx1 = prev.x + (curr.x - prev.x) * tension;
    const cpx2 = curr.x - (curr.x - prev.x) * tension;
    linePath += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  const isPositive = chartData[chartData.length - 1] >= chartData[0];
  const lineColor = isPositive ? "#22c55e" : "#ef4444";
  const changePercent = (
    ((chartData[chartData.length - 1] - chartData[0]) / chartData[0]) *
    100
  ).toFixed(2);

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const activeValue = hoverIndex !== null ? chartData[hoverIndex] : null;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;
      const relX = mouseX - paddingLeft;
      if (relX < 0 || relX > chartWidth) {
        setHoverIndex(null);
        return;
      }
      const idx = Math.round((relX / chartWidth) * (chartData.length - 1));
      setHoverIndex(Math.max(0, Math.min(chartData.length - 1, idx)));
    },
    [chartData.length, chartWidth]
  );

  return (
    <Card className="animate-fade-in-up p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <span className="flex items-center gap-1 rounded-md bg-[var(--color-bg-primary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
              <span className="h-1 w-1 rounded-full bg-[var(--color-positive)] animate-live-pulse" />
              LIVE
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
              {formatPriceFull(activeValue ?? displayPrice)}
            </p>
            <span
              className={`text-sm font-semibold ${isPositive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}
            >
              {isPositive ? "+" : ""}
              {changePercent}%
            </span>
            {activeValue !== null && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {(() => {
                  const pctFromHover = ((activeValue - chartData[0]) / chartData[0] * 100).toFixed(2);
                  const sign = Number(pctFromHover) >= 0 ? "+" : "";
                  return `${sign}${pctFromHover}% vs open`;
                })()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-[var(--color-bg-primary)] p-0.5">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => { setActive(tf); setHoverIndex(null); }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                active === tf
                  ? "bg-[var(--color-bg-card)] text-white shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-2 pb-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Area gradient */}
            <linearGradient id="tvAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
              <stop offset="50%" stopColor={lineColor} stopOpacity="0.05" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
            {/* Line glow */}
            <filter id="tvGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={chartWidth}
            height={chartHeight}
            fill="rgba(10, 14, 26, 0.4)"
            rx="4"
          />

          {/* Horizontal grid lines + Y-axis price labels */}
          {yTicks.map((tick, i) => {
            const y = paddingTop + chartHeight - ((tick - min) / range) * chartHeight;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="var(--color-border-subtle)"
                  strokeWidth="0.5"
                  strokeDasharray={i === 0 || i === tickCount ? "0" : "2 4"}
                  opacity="0.4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--color-text-muted)"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                >
                  {formatPrice(tick)}
                </text>
              </g>
            );
          })}

          {/* Vertical grid lines (subtle) */}
          {chartData.length > 2 &&
            [0.25, 0.5, 0.75].map((pct) => {
              const x = paddingLeft + pct * chartWidth;
              return (
                <line
                  key={pct}
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="var(--color-border-subtle)"
                  strokeWidth="0.5"
                  strokeDasharray="2 4"
                  opacity="0.2"
                />
              );
            })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#tvAreaGrad)" />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#tvGlow)"
          />

          {/* Current price dashed line */}
          <line
            x1={paddingLeft}
            y1={points[points.length - 1].y}
            x2={paddingLeft + chartWidth}
            y2={points[points.length - 1].y}
            stroke={lineColor}
            strokeWidth="0.8"
            strokeDasharray="3 3"
            opacity="0.5"
          />
          {/* Current price label on right */}
          <rect
            x={paddingLeft + chartWidth + 2}
            y={points[points.length - 1].y - 9}
            width={55}
            height={18}
            rx="3"
            fill={lineColor}
            opacity="0.9"
          />
          <text
            x={paddingLeft + chartWidth + 29}
            y={points[points.length - 1].y + 4}
            textAnchor="middle"
            fill="white"
            fontSize="9"
            fontWeight="600"
            fontFamily="ui-monospace, monospace"
          >
            {formatPrice(chartData[chartData.length - 1])}
          </text>

          {/* Live dot on last point */}
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="5"
            fill={lineColor}
            opacity="0.2"
            className="animate-live-pulse"
          />
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="3"
            fill={lineColor}
            stroke="var(--color-bg-card)"
            strokeWidth="1.5"
          />

          {/* Crosshair on hover */}
          {activePoint && (
            <>
              {/* Vertical crosshair */}
              <line
                x1={activePoint.x}
                y1={paddingTop}
                x2={activePoint.x}
                y2={paddingTop + chartHeight}
                stroke="var(--color-text-muted)"
                strokeWidth="0.8"
                strokeDasharray="3 2"
                opacity="0.6"
              />
              {/* Horizontal crosshair */}
              <line
                x1={paddingLeft}
                y1={activePoint.y}
                x2={paddingLeft + chartWidth}
                y2={activePoint.y}
                stroke="var(--color-text-muted)"
                strokeWidth="0.8"
                strokeDasharray="3 2"
                opacity="0.6"
              />
              {/* Hover dot */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                fill={lineColor}
                stroke="white"
                strokeWidth="2"
              />
              {/* Price tooltip on Y-axis */}
              <rect
                x={0}
                y={activePoint.y - 10}
                width={paddingLeft - 4}
                height={20}
                rx="3"
                fill="var(--color-bg-card)"
                stroke="var(--color-border-subtle)"
                strokeWidth="0.5"
              />
              <text
                x={paddingLeft - 8}
                y={activePoint.y + 4}
                textAnchor="end"
                fill="white"
                fontSize="10"
                fontWeight="600"
                fontFamily="ui-monospace, monospace"
              >
                {formatPrice(activeValue!)}
              </text>
            </>
          )}

          {/* Bottom border line */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={paddingLeft + chartWidth}
            y2={paddingTop + chartHeight}
            stroke="var(--color-border-subtle)"
            strokeWidth="0.8"
            opacity="0.5"
          />
          {/* Left border line */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={paddingTop + chartHeight}
            stroke="var(--color-border-subtle)"
            strokeWidth="0.8"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Bottom bar — OHLC style info */}
      <div className="flex items-center gap-6 border-t border-[var(--color-border-subtle)]/50 px-6 py-3 text-xs">
        <span className="text-[var(--color-text-muted)]">
          O <span className="text-white tabular-nums">{formatPriceFull(chartData[0])}</span>
        </span>
        <span className="text-[var(--color-text-muted)]">
          H <span className="text-[var(--color-positive)] tabular-nums">{formatPriceFull(dataMax)}</span>
        </span>
        <span className="text-[var(--color-text-muted)]">
          L <span className="text-[var(--color-negative)] tabular-nums">{formatPriceFull(dataMin)}</span>
        </span>
        <span className="text-[var(--color-text-muted)]">
          C <span className="text-white tabular-nums">{formatPriceFull(chartData[chartData.length - 1])}</span>
        </span>
        <span className={`ml-auto font-semibold ${isPositive ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
          {isPositive ? "+" : ""}{changePercent}%
        </span>
      </div>
    </Card>
  );
}
