"use client";

import { useState, useEffect } from "react";

interface HeatmapCoin {
  symbol: string;
  name: string;
  sparkline7d: number[];
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;

  // Use returns instead of raw prices for better correlation
  const xReturns: number[] = [];
  const yReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (x[i - 1] !== 0 && y[i - 1] !== 0) {
      xReturns.push((x[i] - x[i - 1]) / x[i - 1]);
      yReturns.push((y[i] - y[i - 1]) / y[i - 1]);
    }
  }

  const rn = xReturns.length;
  if (rn < 3) return 0;

  const meanX = xReturns.reduce((a, b) => a + b, 0) / rn;
  const meanY = yReturns.reduce((a, b) => a + b, 0) / rn;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < rn; i++) {
    const dx = xReturns[i] - meanX;
    const dy = yReturns[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;
  return Math.round((num / den) * 100) / 100;
}

function getCorrelationColor(corr: number): string {
  if (corr >= 0.8) return "rgba(59,130,246,0.7)";
  if (corr >= 0.5) return "rgba(59,130,246,0.35)";
  if (corr >= 0.2) return "rgba(163,163,163,0.25)";
  return "rgba(249,115,22,0.4)";
}

function getCorrelationText(corr: number): string {
  if (corr >= 0.8) return "forte";
  if (corr >= 0.5) return "moyenne";
  if (corr >= 0.2) return "faible";
  return "très faible";
}

const SYMBOLS = ["BTC", "ETH", "SOL"];

export default function CorrelationMatrix({ coins }: { coins: HeatmapCoin[] }) {
  const [animated, setAnimated] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Find the 3 main cryptos
  const mainCoins = SYMBOLS.map(s => coins.find(c => c.symbol === s)).filter(Boolean) as HeatmapCoin[];

  // Compute correlation matrix
  const matrix: number[][] = mainCoins.map((coin1, i) =>
    mainCoins.map((coin2, j) => {
      if (i === j) return 1;
      return pearsonCorrelation(coin1.sparkline7d, coin2.sparkline7d);
    })
  );

  const cellSize = 90;
  const labelSize = 50;
  const gap = 3;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Matrice de Corrélation — 7 jours</h2>
      <div className="flex justify-center">
        <div className="relative">
          {/* Column headers */}
          <div className="flex" style={{ paddingLeft: labelSize }}>
            {mainCoins.map((coin) => (
              <div
                key={coin.symbol}
                className="text-center text-xs font-bold text-gray-400"
                style={{ width: cellSize + gap }}
              >
                {coin.symbol}
              </div>
            ))}
          </div>

          {/* Rows */}
          {mainCoins.map((coin1, row) => (
            <div key={coin1.symbol} className="flex items-center" style={{ marginTop: gap }}>
              {/* Row label */}
              <div
                className="text-xs font-bold text-gray-400 text-right pr-3"
                style={{ width: labelSize }}
              >
                {coin1.symbol}
              </div>

              {/* Cells */}
              {mainCoins.map((coin2, col) => {
                const corr = matrix[row]?.[col] ?? 0;
                const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
                const isDiagonal = row === col;
                const cellDelay = (row * 3 + col) * 80;

                return (
                  <div
                    key={col}
                    className="relative flex items-center justify-center rounded-lg transition-all duration-200"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      marginLeft: col > 0 ? gap : 0,
                      backgroundColor: animated ? getCorrelationColor(corr) : "rgba(255,255,255,0.03)",
                      transition: `background-color 0.6s ease ${cellDelay}ms, transform 0.15s ease, box-shadow 0.15s ease`,
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      boxShadow: isHovered ? "0 0 15px rgba(59,130,246,0.3)" : "none",
                      border: isDiagonal ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.05)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setHoveredCell({ row, col })}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <span
                      className="text-lg font-bold font-mono"
                      style={{
                        color: isDiagonal ? "#3b82f6" : corr >= 0.5 ? "#ffffff" : "rgba(255,255,255,0.7)",
                        opacity: animated ? 1 : 0,
                        transition: `opacity 0.4s ease ${cellDelay + 200}ms`,
                      }}
                    >
                      {corr.toFixed(2)}
                    </span>

                    {/* Hover tooltip */}
                    {isHovered && !isDiagonal && (
                      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg border border-white/10 bg-[#0a0a1a]/95 px-3 py-1.5 text-xs shadow-xl">
                        <span className="text-white font-semibold">{coin1.symbol}</span>
                        <span className="text-gray-400"> et </span>
                        <span className="text-white font-semibold">{coin2.symbol}</span>
                        <span className="text-gray-400"> — corrélation {getCorrelationText(corr)}</span>
                        <br />
                        <span className="text-gray-500">Bougent ensemble {Math.round(Math.abs(corr) * 100)}% du temps</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-4 justify-center">
            {[
              { label: "Forte (>0.8)", color: "rgba(59,130,246,0.7)" },
              { label: "Moyenne (0.5-0.8)", color: "rgba(59,130,246,0.35)" },
              { label: "Faible (0.2-0.5)", color: "rgba(163,163,163,0.25)" },
              { label: "Très faible (<0.2)", color: "rgba(249,115,22,0.4)" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
