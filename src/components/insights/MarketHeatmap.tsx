"use client";

import { useState, useEffect, useRef } from "react";

interface HeatmapCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume: number;
}

function getChangeColor(change: number): string {
  if (change > 5) return "#15803d";
  if (change > 2) return "#22c55e";
  if (change > 0) return "#4ade80";
  if (change > -2) return "#f87171";
  if (change > -5) return "#ef4444";
  return "#dc2626";
}

function getChangeBg(change: number): string {
  if (change > 5) return "rgba(21,128,61,0.85)";
  if (change > 2) return "rgba(34,197,94,0.75)";
  if (change > 0) return "rgba(74,222,128,0.6)";
  if (change > -2) return "rgba(248,113,113,0.6)";
  if (change > -5) return "rgba(239,68,68,0.75)";
  return "rgba(220,38,38,0.85)";
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

// Squarified treemap layout algorithm
function squarify(
  items: Array<{ symbol: string; value: number; index: number }>,
  x: number, y: number, w: number, h: number
): Array<{ symbol: string; x: number; y: number; w: number; h: number; index: number }> {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total === 0 || items.length === 0) return [];

  const rects: Array<{ symbol: string; x: number; y: number; w: number; h: number; index: number }> = [];

  let remaining = [...items];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const remainingTotal = remaining.reduce((sum, i) => sum + i.value, 0);
    if (remainingTotal === 0) break;
    const isHorizontal = cw >= ch;

    // Take items for current row
    let row: typeof remaining = [];
    let rowTotal = 0;
    let bestAspect = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const test = [...row, remaining[i]];
      const testTotal = rowTotal + remaining[i].value;
      const sideLen = isHorizontal
        ? (testTotal / remainingTotal) * cw
        : (testTotal / remainingTotal) * ch;

      let worstAspect = 0;
      for (const item of test) {
        const frac = item.value / testTotal;
        const itemW = isHorizontal ? sideLen : cw * frac;
        const itemH = isHorizontal ? ch * frac : sideLen;
        const aspect = Math.max(itemW / (itemH || 1), itemH / (itemW || 1));
        worstAspect = Math.max(worstAspect, aspect);
      }

      if (worstAspect <= bestAspect || row.length === 0) {
        row = test;
        rowTotal = testTotal;
        bestAspect = worstAspect;
      } else {
        break;
      }
    }

    // Layout the row
    const sideLen = isHorizontal
      ? (rowTotal / remainingTotal) * cw
      : (rowTotal / remainingTotal) * ch;

    let offset = 0;
    for (const item of row) {
      const frac = rowTotal > 0 ? item.value / rowTotal : 0;
      if (isHorizontal) {
        rects.push({ symbol: item.symbol, x: cx, y: cy + offset * ch, w: sideLen, h: ch * frac, index: item.index });
        offset += frac;
      } else {
        rects.push({ symbol: item.symbol, x: cx + offset * cw, y: cy, w: cw * frac, h: sideLen, index: item.index });
        offset += frac;
      }
    }

    // Update remaining area
    if (isHorizontal) { cx += sideLen; cw -= sideLen; }
    else { cy += sideLen; ch -= sideLen; }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

export default function MarketHeatmap({ coins }: { coins: HeatmapCoin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(350, width * 0.55) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const sorted = [...coins].sort((a, b) => b.marketCap - a.marketCap);
  // Use sqrt(marketCap) so BTC doesn't dominate 90% of the space
  const items = sorted.map((c, i) => ({ symbol: c.symbol, value: Math.sqrt(c.marketCap), index: i }));
  const rects = squarify(items, 0, 0, dimensions.width, dimensions.height);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-white">Market Heatmap</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-white/5">
        <svg width={dimensions.width} height={dimensions.height} className="block">
          {rects.map((rect, i) => {
            const coin = sorted[rect.index];
            const isHovered = hoveredIndex === rect.index;
            const minDim = Math.min(rect.w, rect.h);
            const showPrice = minDim > 35;
            const showChange = minDim > 28;
            const fontSize = Math.max(8, Math.min(14, minDim / 5));

            return (
              <g
                key={coin.symbol}
                onMouseEnter={() => setHoveredIndex(rect.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  opacity: animated ? 1 : 0,
                  transition: `opacity 0.4s ease ${i * 60}ms, transform 0.2s ease`,
                  cursor: "pointer",
                }}
              >
                <rect
                  x={rect.x + 1}
                  y={rect.y + 1}
                  width={Math.max(0, rect.w - 2)}
                  height={Math.max(0, rect.h - 2)}
                  rx={6}
                  fill={getChangeBg(coin.change24h)}
                  stroke={isHovered ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 12px ${getChangeColor(coin.change24h)}60)` : "none",
                    transition: "all 0.2s ease",
                  }}
                />
                {/* Frosted glass overlay */}
                <rect
                  x={rect.x + 1}
                  y={rect.y + 1}
                  width={Math.max(0, rect.w - 2)}
                  height={Math.max(0, rect.h - 2)}
                  rx={6}
                  fill="rgba(255,255,255,0.03)"
                />
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + rect.h / 2 - (showPrice ? fontSize * 0.8 : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontWeight="700"
                  fontSize={fontSize + 2}
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                >
                  {coin.symbol}
                </text>
                {showPrice && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h / 2 + fontSize * 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.85)"
                    fontSize={fontSize - 1}
                    fontFamily="monospace"
                  >
                    {formatPrice(coin.price)}
                  </text>
                )}
                {showChange && (
                  <text
                    x={rect.x + rect.w / 2}
                    y={rect.y + rect.h / 2 + fontSize * 1.6}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.9)"
                    fontSize={fontSize - 2}
                    fontWeight="600"
                  >
                    {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredIndex !== null && (() => {
          const coin = sorted[hoveredIndex];
          const rect = rects.find(r => r.index === hoveredIndex);
          if (!rect) return null;
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-[#0a0a1a]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm"
              style={{
                left: Math.min(rect.x + rect.w / 2, dimensions.width - 160),
                top: Math.max(0, rect.y - 70),
              }}
            >
              <div className="font-bold text-white">{coin.name} ({coin.symbol})</div>
              <div className="text-gray-400">Prix : {formatPrice(coin.price)}</div>
              <div style={{ color: getChangeColor(coin.change24h) }}>
                24h : {coin.change24h >= 0 ? "+" : ""}{coin.change24h.toFixed(2)}%
              </div>
              <div className="text-gray-400">
                MCap : ${(coin.marketCap / 1e9).toFixed(1)}B
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
