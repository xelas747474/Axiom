// ============================================
// Support/Resistance — Fibonacci, Pivot Points, Swing S/R
// ============================================

import type { OHLCV, FibonacciLevels, PivotPoints, SupportResistance } from "./types";

// Fibonacci Retracement Levels
export function fibonacci(candles: OHLCV[], lookback = 50): FibonacciLevels {
  const recent = candles.slice(-lookback);
  let high = -Infinity;
  let low = Infinity;

  for (const c of recent) {
    high = Math.max(high, c.high);
    low = Math.min(low, c.low);
  }

  const range = high - low;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const labels = ["0%", "23.6%", "38.2%", "50%", "61.8%", "78.6%", "100%"];

  // In an uptrend, Fib retracement goes from high to low
  const isUptrend = recent[recent.length - 1].close > recent[0].close;

  const levels = ratios.map((ratio, i) => ({
    ratio,
    price: isUptrend ? high - range * ratio : low + range * ratio,
    label: labels[i],
  }));

  return { high, low, levels };
}

// Pivot Points (Standard)
export function pivotPoints(candles: OHLCV[]): PivotPoints {
  // Use the last completed candle
  const c = candles[candles.length - 2] ?? candles[candles.length - 1];
  const pp = (c.high + c.low + c.close) / 3;

  return {
    pp,
    r1: 2 * pp - c.low,
    r2: pp + (c.high - c.low),
    r3: c.high + 2 * (pp - c.low),
    s1: 2 * pp - c.high,
    s2: pp - (c.high - c.low),
    s3: c.low - 2 * (c.high - pp),
  };
}

// Auto Support/Resistance from swing highs/lows
export function swingSupportResistance(candles: OHLCV[], lookback = 5, maxLevels = 5): SupportResistance {
  const supports: number[] = [];
  const resistances: number[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isSwingHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) resistances.push(candles[i].high);
    if (isSwingLow) supports.push(candles[i].low);
  }

  // Cluster nearby levels (within 0.5% of each other)
  function cluster(levels: number[]): number[] {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clustered: number[] = [];
    let group = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const avg = group.reduce((a, b) => a + b, 0) / group.length;
      if (Math.abs(sorted[i] - avg) / avg < 0.005) {
        group.push(sorted[i]);
      } else {
        clustered.push(group.reduce((a, b) => a + b, 0) / group.length);
        group = [sorted[i]];
      }
    }
    clustered.push(group.reduce((a, b) => a + b, 0) / group.length);
    return clustered;
  }

  const currentPrice = candles[candles.length - 1].close;

  return {
    supports: cluster(supports)
      .filter((s) => s < currentPrice)
      .sort((a, b) => b - a)
      .slice(0, maxLevels),
    resistances: cluster(resistances)
      .filter((r) => r > currentPrice)
      .sort((a, b) => a - b)
      .slice(0, maxLevels),
  };
}
