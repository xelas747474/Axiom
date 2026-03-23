// ============================================
// Momentum Indicators — RSI, Stochastic RSI, Williams %R, CCI, ROC, MFI
// ============================================

import type { OHLCV, StochRSIResult } from "./types";
import { sma } from "./trend";

// RSI (Relative Strength Index) — Wilder's method
export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Subsequent values using Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

// Stochastic RSI
export function stochasticRSI(closes: number[], rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3): StochRSIResult {
  const rsiValues = rsi(closes, rsiPeriod);
  const len = closes.length;
  const k: number[] = new Array(len).fill(NaN);
  const d: number[] = new Array(len).fill(NaN);

  // Calculate Stochastic of RSI
  for (let i = rsiPeriod + stochPeriod - 1; i < len; i++) {
    let minRSI = Infinity;
    let maxRSI = -Infinity;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (!isNaN(rsiValues[j])) {
        minRSI = Math.min(minRSI, rsiValues[j]);
        maxRSI = Math.max(maxRSI, rsiValues[j]);
      }
    }
    const range = maxRSI - minRSI;
    k[i] = range > 0 ? ((rsiValues[i] - minRSI) / range) * 100 : 50;
  }

  // Smooth K
  const kSmoothed = sma(k.filter((v) => !isNaN(v)), kSmooth);
  let ki = 0;
  for (let i = 0; i < len; i++) {
    if (!isNaN(k[i])) {
      if (ki < kSmoothed.length && !isNaN(kSmoothed[ki])) {
        k[i] = kSmoothed[ki];
      }
      ki++;
    }
  }

  // D = SMA of smoothed K
  const kValid = k.filter((v) => !isNaN(v));
  const dSmoothed = sma(kValid, dSmooth);
  let di = 0;
  for (let i = 0; i < len; i++) {
    if (!isNaN(k[i])) {
      if (di < dSmoothed.length && !isNaN(dSmoothed[di])) {
        d[i] = dSmoothed[di];
      }
      di++;
    }
  }

  return { k, d };
}

// Williams %R
export function williamsR(candles: OHLCV[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, candles[j].high);
      lowestLow = Math.min(lowestLow, candles[j].low);
    }
    const range = highestHigh - lowestLow;
    result[i] = range > 0 ? ((highestHigh - candles[i].close) / range) * -100 : 0;
  }

  return result;
}

// CCI (Commodity Channel Index)
export function cci(candles: OHLCV[], period = 20): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += typicalPrices[j];
    const mean = sum / period;

    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) meanDev += Math.abs(typicalPrices[j] - mean);
    meanDev /= period;

    result[i] = meanDev > 0 ? (typicalPrices[i] - mean) / (0.015 * meanDev) : 0;
  }

  return result;
}

// ROC (Rate of Change)
export function roc(closes: number[], period = 12): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period; i < closes.length; i++) {
    if (closes[i - period] !== 0) {
      result[i] = ((closes[i] - closes[i - period]) / closes[i - period]) * 100;
    }
  }
  return result;
}

// MFI (Money Flow Index)
export function mfi(candles: OHLCV[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period + 1) return result;

  const typicalPrices = candles.map((c) => (c.high + c.low + c.close) / 3);

  for (let i = period; i < candles.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const rawFlow = typicalPrices[j] * candles[j].volume;
      if (typicalPrices[j] > typicalPrices[j - 1]) positiveFlow += rawFlow;
      else if (typicalPrices[j] < typicalPrices[j - 1]) negativeFlow += rawFlow;
    }

    result[i] = negativeFlow === 0 ? 100 : 100 - 100 / (1 + positiveFlow / negativeFlow);
  }

  return result;
}
