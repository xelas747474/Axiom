"use client";

import { useState, useEffect } from "react";

interface CategoryResult {
  category: string;
  score: number;
  details: string;
}

interface CryptoRadarData {
  symbol: string;
  name: string;
  categories: CategoryResult[];
}

const CRYPTO_STYLES: Record<string, { color: string; fill: string }> = {
  BTC: { color: "#f7931a", fill: "rgba(247,147,26,0.15)" },
  ETH: { color: "#627eea", fill: "rgba(98,126,234,0.15)" },
  SOL: { color: "#00ffa3", fill: "rgba(0,255,163,0.15)" },
};

const AXES = ["Tendance", "Momentum", "Volume", "Volatilité", "Sentiment"];

export default function RadarChart({ cryptos }: { cryptos: CryptoRadarData[] }) {
  const [animated, setAnimated] = useState(false);
  const [hoveredCrypto, setHoveredCrypto] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 400);
    return () => clearTimeout(t);
  }, []);

  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const levels = 5;

  function getPoint(axisIndex: number, value: number): { x: number; y: number } {
    const angle = (Math.PI * 2 * axisIndex) / AXES.length - Math.PI / 2;
    const normalized = ((value + 100) / 200) * maxR; // -100..+100 → 0..maxR
    const r = animated ? normalized : 0;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  function getAxisEnd(axisIndex: number): { x: number; y: number } {
    const angle = (Math.PI * 2 * axisIndex) / AXES.length - Math.PI / 2;
    return {
      x: cx + (maxR + 20) * Math.cos(angle),
      y: cy + (maxR + 20) * Math.sin(angle),
    };
  }

  function getPolygonPoints(categories: CategoryResult[]): string {
    return AXES.map((axis, i) => {
      const cat = categories.find(c => c.category === axis);
      const score = cat?.score ?? 0;
      const pt = getPoint(i, score);
      return `${pt.x},${pt.y}`;
    }).join(" ");
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Force Relative — Analyse Multi-dimensionnelle</h2>
      <div className="flex flex-col items-center">
        <svg width={300} height={300} viewBox="0 0 300 300">
          {/* Grid levels */}
          {Array.from({ length: levels }).map((_, lvl) => {
            const r = ((lvl + 1) / levels) * maxR;
            const pts = AXES.map((_, i) => {
              const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
              return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
            }).join(" ");
            return (
              <polygon
                key={lvl}
                points={pts}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}

          {/* Axis lines */}
          {AXES.map((_, i) => {
            const end = getPoint(i, 100);
            // Use the actual max position for axis lines
            const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
            const ex = cx + maxR * Math.cos(angle);
            const ey = cy + maxR * Math.sin(angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={ex}
                y2={ey}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
              />
            );
          })}

          {/* Crypto polygons */}
          {cryptos.map((crypto) => {
            const style = CRYPTO_STYLES[crypto.symbol] ?? { color: "#3b82f6", fill: "rgba(59,130,246,0.15)" };
            const isHovered = hoveredCrypto === crypto.symbol;
            const isOtherHovered = hoveredCrypto !== null && hoveredCrypto !== crypto.symbol;

            return (
              <g
                key={crypto.symbol}
                onMouseEnter={() => setHoveredCrypto(crypto.symbol)}
                onMouseLeave={() => setHoveredCrypto(null)}
                style={{ cursor: "pointer" }}
              >
                <polygon
                  points={getPolygonPoints(crypto.categories)}
                  fill={style.fill}
                  stroke={style.color}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  opacity={isOtherHovered ? 0.2 : 1}
                  style={{
                    transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease",
                    filter: isHovered ? `drop-shadow(0 0 8px ${style.color}60)` : "none",
                  }}
                />
                {/* Data points */}
                {AXES.map((axis, i) => {
                  const cat = crypto.categories.find(c => c.category === axis);
                  const pt = getPoint(i, cat?.score ?? 0);
                  return (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 4 : 2.5}
                      fill={style.color}
                      opacity={isOtherHovered ? 0.2 : 1}
                      style={{ transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s" }}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Axis labels */}
          {AXES.map((axis, i) => {
            const pos = getAxisEnd(i);
            return (
              <text
                key={axis}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
                fontWeight={500}
              >
                {axis}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2">
          {cryptos.map((crypto) => {
            const style = CRYPTO_STYLES[crypto.symbol] ?? { color: "#3b82f6", fill: "" };
            const isActive = hoveredCrypto === crypto.symbol || hoveredCrypto === null;
            return (
              <button
                key={crypto.symbol}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                style={{
                  backgroundColor: `${style.color}15`,
                  color: style.color,
                  opacity: isActive ? 1 : 0.4,
                  border: `1px solid ${style.color}30`,
                }}
                onMouseEnter={() => setHoveredCrypto(crypto.symbol)}
                onMouseLeave={() => setHoveredCrypto(null)}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
                {crypto.symbol}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
