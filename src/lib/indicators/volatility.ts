// ============================================
// Volatility Indicators — Bollinger Bands, ATR, Keltner Channels, StdDev
// ============================================

import type { OHLCV, BollingerResult, KeltnerResult } from "./types";
import { sma, ema } from "./trend";

// Standard Deviation
export function stdDev(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  const means = sma(data, period);

  for (let i = period - 1; i < data.length; i++) {
    if (isNaN(means[i])) continue;
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (data[j] - means[i]) ** 2;
    }
    result[i] = Math.sqrt(sumSq / period);
  }

  return result;
}

// Bollinger Bands (20, 2)
export function bollingerBands(closes: number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(closes, period);
  const sd = stdDev(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);

  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(middle[i]) && !isNaN(sd[i])) {
      upper[i] = middle[i] + multiplier * sd[i];
      lower[i] = middle[i] - multiplier * sd[i];
    }
  }

  return { upper, middle, lower };
}

// ATR (Average True Range) — Wilder's smoothing
export function atr(candles: OHLCV[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period + 1) return result;

  const trueRanges: number[] = [candles[0].high - candles[0].low];

  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trueRanges.push(tr);
  }

  // First ATR = average of first 'period' true ranges
  let atrVal = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = atrVal;

  // Wilder's smoothing
  for (let i = period; i < candles.length; i++) {
    atrVal = (atrVal * (period - 1) + trueRanges[i]) / period;
    result[i] = atrVal;
  }

  return result;
}

// Keltner Channels (20 EMA, 10 ATR, 1.5 multiplier)
export function keltnerChannels(candles: OHLCV[], emaPeriod = 20, atrPeriod = 10, multiplier = 1.5): KeltnerResult {
  const closes = candles.map((c) => c.close);
  const middle = ema(closes, emaPeriod);
  const atrValues = atr(candles, atrPeriod);
  const upper: number[] = new Array(candles.length).fill(NaN);
  const lower: number[] = new Array(candles.length).fill(NaN);

  for (let i = 0; i < candles.length; i++) {
    if (!isNaN(middle[i]) && !isNaN(atrValues[i])) {
      upper[i] = middle[i] + multiplier * atrValues[i];
      lower[i] = middle[i] - multiplier * atrValues[i];
    }
  }

  return { upper, middle, lower };
}
