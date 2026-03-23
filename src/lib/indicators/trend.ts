// ============================================
// Trend Indicators — SMA, EMA, MACD, Ichimoku, ADX, Parabolic SAR
// ============================================

import type { OHLCV, MACDResult, IchimokuResult } from "./types";

// Simple Moving Average
export function sma(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result[i] = sum / period;
  }
  return result;
}

// Exponential Moving Average
export function ema(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);

  // First EMA = SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) sum += data[i];
  if (period <= data.length) {
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
  }
  return result;
}

// MACD (12, 26, 9)
export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MACDResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  // Signal line = EMA(9) of MACD line
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalLine = ema(validMacd, signal);

  // Map signal back to full array
  const result: MACDResult = {
    macd: macdLine,
    signal: new Array(closes.length).fill(NaN),
    histogram: new Array(closes.length).fill(NaN),
  };

  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      if (idx < signalLine.length && !isNaN(signalLine[idx])) {
        result.signal[i] = signalLine[idx];
        result.histogram[i] = macdLine[i] - signalLine[idx];
      }
      idx++;
    }
  }

  return result;
}

// Ichimoku Cloud (9, 26, 52)
export function ichimoku(
  candles: OHLCV[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  senkouBPeriod = 52
): IchimokuResult {
  const len = candles.length;
  const tenkan: number[] = new Array(len).fill(NaN);
  const kijun: number[] = new Array(len).fill(NaN);
  const senkouA: number[] = new Array(len).fill(NaN);
  const senkouB: number[] = new Array(len).fill(NaN);
  const chikou: number[] = new Array(len).fill(NaN);

  function midpoint(start: number, period: number): number {
    let hi = -Infinity, lo = Infinity;
    for (let j = start; j < start + period && j < len; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    return (hi + lo) / 2;
  }

  for (let i = 0; i < len; i++) {
    if (i >= tenkanPeriod - 1) {
      tenkan[i] = midpoint(i - tenkanPeriod + 1, tenkanPeriod);
    }
    if (i >= kijunPeriod - 1) {
      kijun[i] = midpoint(i - kijunPeriod + 1, kijunPeriod);
    }
    if (i >= kijunPeriod - 1 && !isNaN(tenkan[i]) && !isNaN(kijun[i])) {
      const futureIdx = i + kijunPeriod;
      if (futureIdx < len) senkouA[futureIdx] = (tenkan[i] + kijun[i]) / 2;
    }
    if (i >= senkouBPeriod - 1) {
      const mid = midpoint(i - senkouBPeriod + 1, senkouBPeriod);
      const futureIdx = i + kijunPeriod;
      if (futureIdx < len) senkouB[futureIdx] = mid;
    }
    // Chikou span = close shifted back kijunPeriod
    if (i >= kijunPeriod) {
      chikou[i - kijunPeriod] = candles[i].close;
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ADX (Average Directional Index) — 14 periods
export function adx(candles: OHLCV[], period = 14): number[] {
  const len = candles.length;
  const result: number[] = new Array(len).fill(NaN);
  if (len < period + 1) return result;

  const trueRanges: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < len; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;

    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));

    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smoothed values using Wilder's method
  let smoothTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dx: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + trueRanges[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    }

    const plusDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    dx.push(diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);
  }

  // ADX = SMA of DX
  if (dx.length >= period) {
    let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result[2 * period] = adxVal;
    for (let i = period; i < dx.length; i++) {
      adxVal = (adxVal * (period - 1) + dx[i]) / period;
      result[i + period + 1] = adxVal;
    }
  }

  return result;
}

// Parabolic SAR
export function parabolicSAR(candles: OHLCV[], step = 0.02, maxStep = 0.2): number[] {
  const len = candles.length;
  const result: number[] = new Array(len).fill(NaN);
  if (len < 2) return result;

  let isUpTrend = candles[1].close > candles[0].close;
  let af = step;
  let ep = isUpTrend ? candles[0].high : candles[0].low;
  let sar = isUpTrend ? candles[0].low : candles[0].high;

  result[0] = sar;

  for (let i = 1; i < len; i++) {
    const prevSar = sar;
    sar = prevSar + af * (ep - prevSar);

    if (isUpTrend) {
      sar = Math.min(sar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low);
      if (candles[i].low < sar) {
        isUpTrend = false;
        sar = ep;
        ep = candles[i].low;
        af = step;
      } else {
        if (candles[i].high > ep) {
          ep = candles[i].high;
          af = Math.min(af + step, maxStep);
        }
      }
    } else {
      sar = Math.max(sar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high);
      if (candles[i].high > sar) {
        isUpTrend = true;
        sar = ep;
        ep = candles[i].high;
        af = step;
      } else {
        if (candles[i].low < ep) {
          ep = candles[i].low;
          af = Math.min(af + step, maxStep);
        }
      }
    }

    result[i] = sar;
  }

  return result;
}
