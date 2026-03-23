// ============================================
// Volume Indicators — OBV, VWAP, Volume SMA, A/D Line
// ============================================

import type { OHLCV } from "./types";
import { sma } from "./trend";

// OBV (On-Balance Volume)
export function obv(candles: OHLCV[]): number[] {
  const result: number[] = new Array(candles.length).fill(0);
  result[0] = candles[0].volume;

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      result[i] = result[i - 1] + candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      result[i] = result[i - 1] - candles[i].volume;
    } else {
      result[i] = result[i - 1];
    }
  }

  return result;
}

// VWAP (Volume Weighted Average Price) — session-based (resets each day for intraday)
export function vwap(candles: OHLCV[]): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumulativeTPV += tp * candles[i].volume;
    cumulativeVol += candles[i].volume;
    result[i] = cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : tp;
  }

  return result;
}

// Volume SMA
export function volumeSMA(candles: OHLCV[], period = 20): number[] {
  const volumes = candles.map((c) => c.volume);
  return sma(volumes, period);
}

// Accumulation/Distribution Line
export function adLine(candles: OHLCV[]): number[] {
  const result: number[] = new Array(candles.length).fill(0);

  for (let i = 0; i < candles.length; i++) {
    const hlRange = candles[i].high - candles[i].low;
    const clv = hlRange > 0
      ? ((candles[i].close - candles[i].low) - (candles[i].high - candles[i].close)) / hlRange
      : 0;
    const adv = clv * candles[i].volume;
    result[i] = (i > 0 ? result[i - 1] : 0) + adv;
  }

  return result;
}
