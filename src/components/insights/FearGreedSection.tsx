"use client";

import { useState, useEffect } from "react";

interface FngDataPoint {
  value: number;
  timestamp: number;
  classification: string;
}

function getFngColor(value: number): string {
  if (value <= 20) return "#dc2626";
  if (value <= 40) return "#f97316";
  if (value <= 60) return "#eab308";
  if (value <= 80) return "#4ade80";
  return "#15803d";
}

function getFngLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString("fr-FR", { month: "short" })}`;
}

export default function FearGreedSection({
  currentValue,
  history,
}: {
  currentValue: number;
  history: FngDataPoint[];
}) {
  const [animated, setAnimated] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  const avg30 = sortedHistory.length > 0
    ? Math.round(sortedHistory.reduce((a, d) => a + d.value, 0) / sortedHistory.length)
    : currentValue;

  // Gauge arc
  const gaugeRadius = 90;
  const gaugeStroke = 16;
  const gaugeCx = 120;
  const gaugeCy = 110;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;
  const needleAngle = startAngle + (currentValue / 100) * totalAngle;

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
    const s = polarToCartesian(cx, cy, r, start);
    const e = polarToCartesian(cx, cy, r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const barWidth = sortedHistory.length > 0 ? Math.max(6, Math.min(16, 500 / sortedHistory.length - 2)) : 12;
  const chartHeight = 160;
  const chartWidth = Math.max(400, sortedHistory.length * (barWidth + 3));

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">
        Fear & Greed Index — Historique 30 jours
      </h2>

      <div className="flex flex-col items-center gap-6">
        {/* Giant gauge */}
        <div className="relative">
          <svg width={240} height={140} viewBox="0 0 240 140">
            <defs>
              <linearGradient id="fng-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="25%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
            </defs>
            {/* Background arc */}
            <path
              d={describeArc(gaugeCx, gaugeCy, gaugeRadius, startAngle, endAngle)}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={gaugeStroke}
              strokeLinecap="round"
            />
            {/* Colored arc */}
            <path
              d={describeArc(gaugeCx, gaugeCy, gaugeRadius, startAngle, endAngle)}
              fill="none"
              stroke="url(#fng-arc-grad)"
              strokeWidth={gaugeStroke}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${getFngColor(currentValue)}40)` }}
            />
            {/* Needle */}
            {animated && (() => {
              const tip = polarToCartesian(gaugeCx, gaugeCy, gaugeRadius - gaugeStroke, needleAngle);
              return (
                <g style={{ transition: "all 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                  <line
                    x1={gaugeCx}
                    y1={gaugeCy}
                    x2={tip.x}
                    y2={tip.y}
                    stroke="white"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.5))" }}
                  />
                  <circle cx={gaugeCx} cy={gaugeCy} r={5} fill="white" />
                </g>
              );
            })()}
          </svg>
          {/* Score display */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: getFngColor(currentValue), textShadow: `0 0 20px ${getFngColor(currentValue)}40` }}
            >
              {animated ? currentValue : 0}
            </div>
          </div>
        </div>

        <div className="text-center -mt-2">
          <div
            className="text-lg font-bold"
            style={{ color: getFngColor(currentValue) }}
          >
            {getFngLabel(currentValue)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Moyenne 30j : {avg30}/100</div>
        </div>

        {/* Historical bars */}
        {sortedHistory.length > 0 && (
          <div className="w-full overflow-x-auto">
            <div className="relative mx-auto" style={{ width: chartWidth, height: chartHeight + 30 }}>
              <svg width={chartWidth} height={chartHeight + 30}>
                {/* Average line */}
                <line
                  x1={0}
                  y1={chartHeight - (avg30 / 100) * chartHeight}
                  x2={chartWidth}
                  y2={chartHeight - (avg30 / 100) * chartHeight}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={chartWidth - 4}
                  y={chartHeight - (avg30 / 100) * chartHeight - 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.25)"
                  fontSize={9}
                >
                  Moy. {avg30}
                </text>

                {sortedHistory.map((d, i) => {
                  const barH = animated ? (d.value / 100) * chartHeight : 0;
                  const x = i * (barWidth + 3) + 4;
                  const isHovered = hoveredBar === i;

                  return (
                    <g
                      key={i}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={x}
                        y={chartHeight - barH}
                        width={barWidth}
                        height={barH}
                        rx={2}
                        fill={getFngColor(d.value)}
                        opacity={isHovered ? 1 : 0.75}
                        style={{
                          transition: `height 0.6s ease ${i * 30}ms, y 0.6s ease ${i * 30}ms, opacity 0.15s`,
                          filter: isHovered ? `drop-shadow(0 0 6px ${getFngColor(d.value)}80)` : "none",
                        }}
                      />
                      {/* X-axis label (every 5th) */}
                      {i % 5 === 0 && (
                        <text
                          x={x + barWidth / 2}
                          y={chartHeight + 14}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.3)"
                          fontSize={8}
                        >
                          {formatDate(d.timestamp)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredBar !== null && sortedHistory[hoveredBar] && (
                <div
                  className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-[#0a0a1a]/95 px-3 py-1.5 text-xs shadow-xl"
                  style={{
                    left: hoveredBar * (barWidth + 3) + barWidth / 2,
                    top: chartHeight - (sortedHistory[hoveredBar].value / 100) * chartHeight - 45,
                  }}
                >
                  <div className="text-gray-400">{formatDate(sortedHistory[hoveredBar].timestamp)}</div>
                  <div className="font-bold" style={{ color: getFngColor(sortedHistory[hoveredBar].value) }}>
                    {sortedHistory[hoveredBar].value} — {getFngLabel(sortedHistory[hoveredBar].value)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
