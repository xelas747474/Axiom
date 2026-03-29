// ============================================
// Market Regime Detection — Identifies current market state
// trending_up, trending_down, ranging, volatile
// Adjusts strategy parameters based on regime
// ============================================

import type { OHLCV } from "@/lib/indicators/types";

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface RegimeAnalysis {
  regime: MarketRegime;
  confidence: number;       // 0-100
  adx: number | null;       // Average Directional Index
  volatilityRank: number;   // 0-100 percentile
  trendConsistency: number; // 0-1 how consistent the trend is
  details: string;
}

export interface StrategyAdjustment {
  scoreThresholdMultiplier: number;   // >1 = more selective, <1 = less selective
  positionSizeMultiplier: number;     // Reduce in volatile, increase in trending
  stopLossMultiplier: number;         // Wider in volatile
  takeProfitMultiplier: number;       // Wider in trending
  trailingStopEnabled: boolean;
  preferredDirection: "LONG" | "SHORT" | "BOTH";
}

function computeADX(candles: OHLCV[], period = 14): number | null {
  if (candles.length < period * 2) return null;

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;

    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));

    const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
    const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  if (trueRanges.length < period) return null;

  // Smoothed averages
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let smoothPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let smoothMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    smoothPlusDM = (smoothPlusDM * (period - 1) + plusDMs[i]) / period;
    smoothMinusDM = (smoothMinusDM * (period - 1) + minusDMs[i]) / period;

    const plusDI = atr > 0 ? (smoothPlusDM / atr) * 100 : 0;
    const minusDI = atr > 0 ? (smoothMinusDM / atr) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxValues.push(dx);
  }

  if (dxValues.length < period) return dxValues.length > 0 ? dxValues[dxValues.length - 1] : null;
  return dxValues.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function computeVolatilityRank(candles: OHLCV[], lookback = 30): number {
  if (candles.length < lookback) return 50;

  const closes = candles.map(c => c.close);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]));
  }

  const recentReturns = returns.slice(-Math.min(lookback, returns.length));
  const currentVol = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;

  // Compare to all historical returns windows
  const windows: number[] = [];
  for (let i = lookback; i <= returns.length; i++) {
    const window = returns.slice(i - lookback, i);
    windows.push(window.reduce((a, b) => a + b, 0) / window.length);
  }

  if (windows.length === 0) return 50;
  const rank = windows.filter(w => w < currentVol).length / windows.length;
  return Math.round(rank * 100);
}

function computeTrendConsistency(candles: OHLCV[], lookback = 20): number {
  const closes = candles.slice(-lookback).map(c => c.close);
  if (closes.length < 5) return 0;

  const isUpOverall = closes[closes.length - 1] > closes[0];
  let consistent = 0;
  for (let i = 1; i < closes.length; i++) {
    const up = closes[i] > closes[i - 1];
    if (up === isUpOverall) consistent++;
  }
  return consistent / (closes.length - 1);
}

export function detectRegime(candles: OHLCV[]): RegimeAnalysis {
  const adxValue = computeADX(candles);
  const volRank = computeVolatilityRank(candles);
  const trendConsistency = computeTrendConsistency(candles);

  const closes = candles.map(c => c.close);
  const recent = closes.slice(-20);
  const priceChange = recent.length >= 2
    ? ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100
    : 0;

  let regime: MarketRegime;
  let confidence: number;

  // Decision tree for regime classification
  if (volRank > 75 && (adxValue === null || adxValue < 20)) {
    // High volatility + weak trend = volatile/choppy
    regime = "volatile";
    confidence = Math.min(90, volRank);
  } else if (adxValue !== null && adxValue > 25 && trendConsistency > 0.55) {
    // Strong ADX + consistent direction = trending
    regime = priceChange > 0 ? "trending_up" : "trending_down";
    confidence = Math.min(95, Math.round(adxValue * 1.5 + trendConsistency * 30));
  } else if (adxValue !== null && adxValue < 20 && volRank < 40) {
    // Weak ADX + low volatility = ranging
    regime = "ranging";
    confidence = Math.round(60 + (20 - adxValue) * 2);
  } else {
    // Ambiguous — classify by dominant feature
    if (trendConsistency > 0.6 && Math.abs(priceChange) > 2) {
      regime = priceChange > 0 ? "trending_up" : "trending_down";
      confidence = Math.round(trendConsistency * 70);
    } else if (volRank > 60) {
      regime = "volatile";
      confidence = Math.round(volRank * 0.7);
    } else {
      regime = "ranging";
      confidence = 40;
    }
  }

  const details = [
    `Regime: ${regime}`,
    adxValue !== null ? `ADX: ${adxValue.toFixed(1)}` : null,
    `Vol rank: ${volRank}th`,
    `Consistency: ${(trendConsistency * 100).toFixed(0)}%`,
    `Price Δ20: ${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`,
  ].filter(Boolean).join(" | ");

  return {
    regime,
    confidence: Math.min(100, confidence),
    adx: adxValue,
    volatilityRank: volRank,
    trendConsistency,
    details,
  };
}

/**
 * Get strategy adjustments based on detected regime
 */
export function getRegimeAdjustment(regime: RegimeAnalysis): StrategyAdjustment {
  switch (regime.regime) {
    case "trending_up":
      return {
        scoreThresholdMultiplier: 0.85,    // Lower threshold = enter more easily
        positionSizeMultiplier: 1.15,      // Slightly larger positions
        stopLossMultiplier: 1.2,           // Wider SL to ride the trend
        takeProfitMultiplier: 1.5,         // Wider TP to capture trend
        trailingStopEnabled: true,
        preferredDirection: "LONG",
      };
    case "trending_down":
      return {
        scoreThresholdMultiplier: 0.85,
        positionSizeMultiplier: 1.1,
        stopLossMultiplier: 1.2,
        takeProfitMultiplier: 1.5,
        trailingStopEnabled: true,
        preferredDirection: "SHORT",
      };
    case "ranging":
      return {
        scoreThresholdMultiplier: 1.3,     // Higher threshold = be more selective
        positionSizeMultiplier: 0.8,       // Smaller positions
        stopLossMultiplier: 0.8,           // Tighter SL
        takeProfitMultiplier: 0.7,         // Tighter TP (mean reversion)
        trailingStopEnabled: false,
        preferredDirection: "BOTH",
      };
    case "volatile":
      return {
        scoreThresholdMultiplier: 1.5,     // Very selective
        positionSizeMultiplier: 0.6,       // Much smaller positions
        stopLossMultiplier: 1.5,           // Wider SL to avoid noise
        takeProfitMultiplier: 1.3,         // Wider TP
        trailingStopEnabled: true,
        preferredDirection: "BOTH",
      };
  }
}

/**
 * Score the regime from -100 to +100
 * Used as a component in the advanced scoring engine
 */
export function scoreRegime(regime: RegimeAnalysis): {
  score: number;
  details: string;
} {
  let score = 0;

  switch (regime.regime) {
    case "trending_up":
      score = Math.round(30 + regime.confidence * 0.4); // 30-70
      break;
    case "trending_down":
      score = -Math.round(30 + regime.confidence * 0.4); // -30 to -70
      break;
    case "ranging":
      score = 0; // Neutral — no directional bias
      break;
    case "volatile":
      score = -Math.round(regime.confidence * 0.2); // Slightly negative (more risk)
      break;
  }

  return {
    score: Math.max(-100, Math.min(100, score)),
    details: regime.details,
  };
}
