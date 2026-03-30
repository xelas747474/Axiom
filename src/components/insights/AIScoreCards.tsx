"use client";

import { useState, useEffect } from "react";
import { getSignalInfo, GAUGE_GRADIENT_STOPS } from "@/lib/signals";
import Link from "next/link";

interface CategoryResult {
  category: string;
  score: number;
  details: string;
}

interface AIScoreData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  sparkline7d: number[];
  score: number;
  categories: CategoryResult[];
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  unavailable?: boolean;
}

const CRYPTO_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#00ffa3",
};

function MiniSparkline({ data, color, width = 100, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ScoreGauge({ score, animated }: { score: number; animated: boolean }) {
  const info = getSignalInfo(score);
  const radius = 60;
  const stroke = 10;
  const cx = 75;
  const cy = 70;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;

  function polarToCartesian(r: number, angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(r: number, start: number, end: number) {
    const s = polarToCartesian(r, start);
    const e = polarToCartesian(r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const normalizedScore = (score + 100) / 200; // 0 to 1
  const needleAngle = startAngle + normalizedScore * totalAngle;
  const tip = polarToCartesian(radius - stroke - 2, animated ? needleAngle : startAngle);

  return (
    <svg width={150} height={90} viewBox="0 0 150 90">
      <defs>
        <linearGradient id="score-gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          {GAUGE_GRADIENT_STOPS.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={describeArc(radius, startAngle, endAngle)}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={describeArc(radius, startAngle, endAngle)}
        fill="none"
        stroke="url(#score-gauge-grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${info.color}30)` }}
      />
      <line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        style={{ transition: "all 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <circle cx={cx} cy={cy} r={3.5} fill="white" />
    </svg>
  );
}

function CategoryBar({ category, score, animated, delay }: { category: string; score: number; animated: boolean; delay: number }) {
  const normalized = (score + 100) / 200; // 0 to 1
  const color = score > 20 ? "#22c55e" : score < -20 ? "#ef4444" : "#a3a3a3";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 shrink-0 truncate">{category}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: animated ? `${normalized * 100}%` : "0%",
            backgroundColor: color,
            transition: `width 0.8s ease ${delay}ms`,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>
        {score > 0 ? "+" : ""}{score}
      </span>
    </div>
  );
}

export default function AIScoreCards({ scores }: { scores: AIScoreData[] }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Signaux IA — Vue Détaillée</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {scores.map((crypto, cardIdx) => {
          const info = getSignalInfo(crypto.score);
          const accent = CRYPTO_COLORS[crypto.symbol] ?? "#3b82f6";

          return (
            <Link
              href={`/trading?crypto=${crypto.symbol}USDT`}
              key={crypto.id}
              className="group block rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
              style={{
                opacity: animated ? 1 : 0,
                transform: animated ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.5s ease ${cardIdx * 150}ms, transform 0.5s ease ${cardIdx * 150}ms`,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{crypto.symbol}</span>
                    <span className="text-xs text-gray-500">{crypto.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {crypto.unavailable ? (
                      <span className="text-xs text-amber-400/80 italic">Données temporairement indisponibles</span>
                    ) : (
                      <>
                        <span className="text-sm font-mono text-white">
                          ${crypto.price >= 1 ? crypto.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : crypto.price.toFixed(4)}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: crypto.change24h >= 0 ? "#22c55e" : "#ef4444" }}
                        >
                          {crypto.change24h >= 0 ? "+" : ""}{crypto.change24h.toFixed(2)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!crypto.unavailable && (
                  <MiniSparkline data={crypto.sparkline7d} color={accent} width={80} height={28} />
                )}
              </div>

              {crypto.unavailable ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="text-2xl mb-2 opacity-40">⏳</div>
                  <p className="text-xs text-gray-500">
                    Les données de {crypto.name} sont temporairement<br />indisponibles (rate-limit API)
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">Rechargez dans quelques secondes</p>
                </div>
              ) : (
                <>
                  {/* Gauge + Signal */}
                  <div className="flex items-center gap-3 mb-3">
                    <ScoreGauge score={crypto.score} animated={animated} />
                    <div>
                      <div
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: info.bgColor, color: info.color }}
                      >
                        {info.emoji} {info.label}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-[120px]">{info.description}</p>
                      <div
                        className="text-lg font-bold font-mono mt-1"
                        style={{ color: info.color, textShadow: `0 0 12px ${info.color}30` }}
                      >
                        {crypto.score > 0 ? "+" : ""}{crypto.score}
                      </div>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  <div className="space-y-1.5 mb-3">
                    {crypto.categories.map((cat, i) => (
                      <CategoryBar
                        key={cat.category}
                        category={cat.category}
                        score={cat.score}
                        animated={animated}
                        delay={cardIdx * 150 + i * 80}
                      />
                    ))}
                  </div>

                  {/* Entry / SL / TP */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase">Entrée</div>
                      <div className="text-xs font-mono text-blue-400">${crypto.entryPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase">Stop Loss</div>
                      <div className="text-xs font-mono text-red-400">${crypto.stopLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase">Take Profit</div>
                      <div className="text-xs font-mono text-green-400">${crypto.takeProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    </div>
                  </div>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
