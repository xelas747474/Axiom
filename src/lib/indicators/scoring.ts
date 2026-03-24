// ============================================
// AI Scoring Engine — Combines all indicators into a weighted signal
// ============================================

import type {
  OHLCV,
  SignalStrength,
  IndicatorScore,
  CategoryScore,
  AISignalResult,
} from "./types";
import { sma, ema, macd, ichimoku, adx, parabolicSAR } from "./trend";
import { rsi, stochasticRSI, williamsR, cci, roc, mfi } from "./momentum";
import { bollingerBands, atr, keltnerChannels } from "./volatility";
import { obv, vwap, volumeSMA, adLine } from "./volume";
import { fibonacci, pivotPoints, swingSupportResistance } from "./support";

function toSignal(score: number): SignalStrength {
  if (score > 60) return "STRONG_BUY";
  if (score > 20) return "BUY";
  if (score > -20) return "NEUTRAL";
  if (score > -60) return "SELL";
  return "STRONG_SELL";
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

function prevValid(arr: number[], fromEnd = 1): number {
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) {
      if (count === fromEnd) return arr[i];
      count++;
    }
  }
  return NaN;
}

// ============================================
// Trend scoring (30% weight)
// ============================================
function scoreTrend(candles: OHLCV[]): CategoryScore {
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const indicators: IndicatorScore[] = [];

  // SMA 20/50/200
  const sma20 = last(sma(closes, 20));
  const sma50 = last(sma(closes, 50));
  const sma200 = last(sma(closes, Math.min(200, closes.length)));

  let smaScore = 0;
  let smaDesc = "";
  if (!isNaN(sma20)) {
    if (currentPrice > sma20) smaScore += 30;
    else smaScore -= 30;
  }
  if (!isNaN(sma50)) {
    if (currentPrice > sma50) smaScore += 20;
    else smaScore -= 20;
    if (!isNaN(sma20)) {
      if (sma20 > sma50) { smaScore += 15; smaDesc = "Golden cross pattern (SMA20 > SMA50)"; }
      else { smaScore -= 15; smaDesc = "Death cross pattern (SMA20 < SMA50)"; }
    }
  }
  if (!isNaN(sma200)) {
    if (currentPrice > sma200) { smaScore += 35; smaDesc += " Prix au-dessus SMA200."; }
    else { smaScore -= 35; smaDesc += " Prix sous SMA200."; }
  }
  indicators.push({ name: "SMA (20/50/200)", score: clamp(smaScore, -100, 100), signal: toSignal(smaScore), description: smaDesc || "Moyennes mobiles" });

  // EMA 12/26
  const ema12 = last(ema(closes, 12));
  const ema26 = last(ema(closes, 26));
  let emaScore = 0;
  if (!isNaN(ema12) && !isNaN(ema26)) {
    emaScore = ema12 > ema26 ? 60 : -60;
    if (currentPrice > ema12) emaScore += 20;
    else emaScore -= 20;
  }
  indicators.push({ name: "EMA (12/26)", score: clamp(emaScore, -100, 100), signal: toSignal(emaScore), description: ema12 > ema26 ? "EMA12 au-dessus EMA26 — momentum haussier" : "EMA12 sous EMA26 — momentum baissier" });

  // MACD
  const macdResult = macd(closes);
  const macdVal = last(macdResult.macd);
  const macdSig = last(macdResult.signal);
  const macdHist = last(macdResult.histogram);
  const prevHist = prevValid(macdResult.histogram, 1);
  let macdScore = 0;
  let macdDesc = "";
  if (!isNaN(macdVal) && !isNaN(macdSig)) {
    if (macdVal > macdSig) macdScore += 40;
    else macdScore -= 40;
    if (macdVal > 0) macdScore += 20;
    else macdScore -= 20;
    if (!isNaN(macdHist) && !isNaN(prevHist)) {
      if (macdHist > prevHist) { macdScore += 30; macdDesc = "Histogramme MACD en expansion"; }
      else { macdScore -= 30; macdDesc = "Histogramme MACD en contraction"; }
    }
  }
  indicators.push({ name: "MACD", score: clamp(macdScore, -100, 100), signal: toSignal(macdScore), description: macdDesc || "MACD Signal" });

  // Ichimoku
  const ich = ichimoku(candles);
  const tenkan = last(ich.tenkan);
  const kijun = last(ich.kijun);
  let ichScore = 0;
  if (!isNaN(tenkan) && !isNaN(kijun)) {
    if (tenkan > kijun) ichScore += 40;
    else ichScore -= 40;
    if (currentPrice > tenkan) ichScore += 30;
    else ichScore -= 30;
  }
  indicators.push({ name: "Ichimoku", score: clamp(ichScore, -100, 100), signal: toSignal(ichScore), description: tenkan > kijun ? "Tenkan au-dessus Kijun — signal haussier" : "Tenkan sous Kijun — signal baissier" });

  // ADX
  const adxVal = last(adx(candles));
  let adxScore = 0;
  if (!isNaN(adxVal)) {
    // ADX measures trend strength, not direction. Use price direction for sign.
    const trendUp = currentPrice > closes[Math.max(0, closes.length - 15)];
    if (adxVal > 25) adxScore = trendUp ? 50 : -50;
    else adxScore = 0; // Weak trend = neutral
  }
  indicators.push({ name: "ADX", score: clamp(adxScore, -100, 100), signal: toSignal(adxScore), description: adxVal > 25 ? `Tendance forte (ADX: ${adxVal.toFixed(1)})` : `Tendance faible (ADX: ${(adxVal || 0).toFixed(1)})` });

  // Parabolic SAR
  const sar = last(parabolicSAR(candles));
  let sarScore = 0;
  if (!isNaN(sar)) {
    sarScore = currentPrice > sar ? 70 : -70;
  }
  indicators.push({ name: "Parabolic SAR", score: clamp(sarScore, -100, 100), signal: toSignal(sarScore), description: currentPrice > sar ? "SAR sous le prix — tendance haussière" : "SAR au-dessus du prix — tendance baissière" });

  const avgScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;
  return { category: "Tendance", weight: 0.30, score: Math.round(avgScore), signal: toSignal(avgScore), indicators };
}

// ============================================
// Momentum scoring (25% weight)
// ============================================
function scoreMomentum(candles: OHLCV[]): CategoryScore {
  const closes = candles.map((c) => c.close);
  const indicators: IndicatorScore[] = [];

  // RSI
  const rsiVal = last(rsi(closes));
  let rsiScore = 0;
  if (!isNaN(rsiVal)) {
    if (rsiVal < 30) rsiScore = 80; // Oversold = buy
    else if (rsiVal < 40) rsiScore = 40;
    else if (rsiVal < 60) rsiScore = 0;
    else if (rsiVal < 70) rsiScore = -40;
    else rsiScore = -80; // Overbought = sell
  }
  indicators.push({ name: "RSI (14)", score: rsiScore, signal: toSignal(rsiScore), description: `RSI à ${(rsiVal || 50).toFixed(1)} — ${rsiVal < 30 ? "survendu" : rsiVal > 70 ? "suracheté" : "neutre"}` });

  // Stochastic RSI
  const stochResult = stochasticRSI(closes);
  const stochK = last(stochResult.k);
  const stochD = last(stochResult.d);
  let stochScore = 0;
  if (!isNaN(stochK)) {
    if (stochK < 20) stochScore = 70;
    else if (stochK > 80) stochScore = -70;
    else stochScore = 0;
    if (!isNaN(stochD) && stochK > stochD) stochScore += 15;
    else stochScore -= 15;
  }
  indicators.push({ name: "Stoch RSI", score: clamp(stochScore, -100, 100), signal: toSignal(stochScore), description: `K: ${(stochK || 50).toFixed(1)}, D: ${(stochD || 50).toFixed(1)}` });

  // Williams %R
  const wrVal = last(williamsR(candles));
  let wrScore = 0;
  if (!isNaN(wrVal)) {
    if (wrVal < -80) wrScore = 70;
    else if (wrVal > -20) wrScore = -70;
    else wrScore = 0;
  }
  indicators.push({ name: "Williams %R", score: wrScore, signal: toSignal(wrScore), description: `Williams %R à ${(wrVal || -50).toFixed(1)}` });

  // CCI
  const cciVal = last(cci(candles));
  let cciScore = 0;
  if (!isNaN(cciVal)) {
    if (cciVal > 200) cciScore = -60;
    else if (cciVal > 100) cciScore = 30;
    else if (cciVal > -100) cciScore = 0;
    else if (cciVal > -200) cciScore = -30;
    else cciScore = 60;
  }
  indicators.push({ name: "CCI", score: cciScore, signal: toSignal(cciScore), description: `CCI à ${(cciVal || 0).toFixed(1)}` });

  // ROC
  const rocVal = last(roc(closes));
  let rocScore = 0;
  if (!isNaN(rocVal)) {
    rocScore = clamp(rocVal * 5, -80, 80);
  }
  indicators.push({ name: "ROC", score: rocScore, signal: toSignal(rocScore), description: `Rate of Change: ${(rocVal || 0).toFixed(2)}%` });

  // MFI
  const mfiVal = last(mfi(candles));
  let mfiScore = 0;
  if (!isNaN(mfiVal)) {
    if (mfiVal < 20) mfiScore = 70;
    else if (mfiVal > 80) mfiScore = -70;
    else mfiScore = (mfiVal - 50) * -1.5;
  }
  indicators.push({ name: "MFI", score: clamp(Math.round(mfiScore), -100, 100), signal: toSignal(mfiScore), description: `Money Flow Index: ${(mfiVal || 50).toFixed(1)}` });

  const avgScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;
  return { category: "Momentum", weight: 0.25, score: Math.round(avgScore), signal: toSignal(avgScore), indicators };
}

// ============================================
// Volume scoring (20% weight)
// ============================================
function scoreVolume(candles: OHLCV[]): CategoryScore {
  const closes = candles.map((c) => c.close);
  const indicators: IndicatorScore[] = [];

  // OBV trend
  const obvValues = obv(candles);
  const obvCurrent = obvValues[obvValues.length - 1];
  const obvPrev = obvValues[Math.max(0, obvValues.length - 10)];
  let obvScore = 0;
  if (obvCurrent > obvPrev) obvScore = 60;
  else if (obvCurrent < obvPrev) obvScore = -60;
  indicators.push({ name: "OBV", score: obvScore, signal: toSignal(obvScore), description: obvCurrent > obvPrev ? "Volume cumulé en hausse" : "Volume cumulé en baisse" });

  // VWAP
  const vwapVal = last(vwap(candles));
  const currentPrice = closes[closes.length - 1];
  let vwapScore = 0;
  if (!isNaN(vwapVal)) {
    vwapScore = currentPrice > vwapVal ? 60 : -60;
  }
  indicators.push({ name: "VWAP", score: vwapScore, signal: toSignal(vwapScore), description: currentPrice > vwapVal ? "Prix au-dessus du VWAP" : "Prix sous le VWAP" });

  // Volume vs SMA
  const volSma = last(volumeSMA(candles));
  const currentVol = candles[candles.length - 1].volume;
  let volScore = 0;
  if (!isNaN(volSma) && volSma > 0) {
    const ratio = currentVol / volSma;
    if (ratio > 1.5) volScore = candles[candles.length - 1].close > candles[candles.length - 2]?.close ? 70 : -70;
    else if (ratio > 1) volScore = 20;
    else volScore = -20;
  }
  indicators.push({ name: "Volume SMA", score: volScore, signal: toSignal(volScore), description: `Volume relatif: ${volSma > 0 ? (currentVol / volSma).toFixed(2) : "N/A"}x` });

  // A/D Line
  const adValues = adLine(candles);
  const adCurrent = adValues[adValues.length - 1];
  const adPrev = adValues[Math.max(0, adValues.length - 10)];
  let adScore = 0;
  if (adCurrent > adPrev) adScore = 50;
  else adScore = -50;
  indicators.push({ name: "A/D Line", score: adScore, signal: toSignal(adScore), description: adCurrent > adPrev ? "Accumulation détectée" : "Distribution détectée" });

  const avgScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;
  return { category: "Volume", weight: 0.20, score: Math.round(avgScore), signal: toSignal(avgScore), indicators };
}

// ============================================
// Volatility scoring (15% weight)
// ============================================
function scoreVolatility(candles: OHLCV[]): CategoryScore {
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const indicators: IndicatorScore[] = [];

  // Bollinger Bands position
  const bb = bollingerBands(closes);
  const bbUpper = last(bb.upper);
  const bbLower = last(bb.lower);
  const bbMiddle = last(bb.middle);
  let bbScore = 0;
  if (!isNaN(bbUpper) && !isNaN(bbLower)) {
    const bbRange = bbUpper - bbLower;
    if (bbRange > 0) {
      const pos = (currentPrice - bbLower) / bbRange;
      if (pos < 0.2) bbScore = 70; // Near lower band = buy
      else if (pos > 0.8) bbScore = -70; // Near upper band = sell
      else bbScore = (0.5 - pos) * 100;
    }
  }
  indicators.push({ name: "Bollinger Bands", score: clamp(Math.round(bbScore), -100, 100), signal: toSignal(bbScore), description: `Prix ${currentPrice > bbMiddle ? "au-dessus" : "en-dessous"} de la bande médiane` });

  // ATR (volatility level)
  const atrVal = last(atr(candles));
  let atrScore = 0;
  if (!isNaN(atrVal) && currentPrice > 0) {
    const atrPct = (atrVal / currentPrice) * 100;
    // High ATR = more risk, slight negative bias
    if (atrPct > 5) atrScore = -30;
    else if (atrPct > 3) atrScore = -10;
    else atrScore = 10;
  }
  indicators.push({ name: "ATR", score: atrScore, signal: toSignal(atrScore), description: `ATR: ${(atrVal || 0).toFixed(2)} (${atrVal && currentPrice > 0 ? ((atrVal / currentPrice) * 100).toFixed(2) : "0"}%)` });

  // Keltner Channels
  const kc = keltnerChannels(candles);
  const kcUpper = last(kc.upper);
  const kcLower = last(kc.lower);
  let kcScore = 0;
  if (!isNaN(kcUpper) && !isNaN(kcLower)) {
    if (currentPrice > kcUpper) kcScore = -50; // Overextended up
    else if (currentPrice < kcLower) kcScore = 50; // Overextended down
    else kcScore = 0;
  }
  indicators.push({ name: "Keltner Channels", score: kcScore, signal: toSignal(kcScore), description: currentPrice > kcUpper ? "Breakout haussier Keltner" : currentPrice < kcLower ? "Breakout baissier Keltner" : "Dans le canal Keltner" });

  const avgScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;
  return { category: "Volatilité", weight: 0.15, score: Math.round(avgScore), signal: toSignal(avgScore), indicators };
}

// ============================================
// Support/Resistance scoring (10% weight)
// ============================================
function scoreSupportResistance(candles: OHLCV[]): CategoryScore {
  const currentPrice = candles[candles.length - 1].close;
  const indicators: IndicatorScore[] = [];

  // Fibonacci
  const fib = fibonacci(candles);
  const fib382 = fib.levels.find((l) => l.ratio === 0.382)?.price ?? 0;
  const fib618 = fib.levels.find((l) => l.ratio === 0.618)?.price ?? 0;
  let fibScore = 0;
  if (currentPrice > fib382 && currentPrice > fib618) fibScore = 50;
  else if (currentPrice < fib618 && currentPrice < fib382) fibScore = -50;
  else fibScore = 0;
  indicators.push({ name: "Fibonacci", score: fibScore, signal: toSignal(fibScore), description: `Prix ${currentPrice > fib618 ? "au-dessus" : "en-dessous"} du 61.8%` });

  // Pivot Points
  const pp = pivotPoints(candles);
  let ppScore = 0;
  if (currentPrice > pp.r1) ppScore = 60;
  else if (currentPrice > pp.pp) ppScore = 30;
  else if (currentPrice > pp.s1) ppScore = -30;
  else ppScore = -60;
  indicators.push({ name: "Pivot Points", score: ppScore, signal: toSignal(ppScore), description: `Prix ${currentPrice > pp.pp ? "au-dessus" : "en-dessous"} du pivot (${pp.pp.toFixed(2)})` });

  // Swing S/R proximity
  const sr = swingSupportResistance(candles);
  let srScore = 0;
  const nearestSupport = sr.supports[0];
  const nearestResistance = sr.resistances[0];
  if (nearestSupport && nearestResistance) {
    const distToSupport = (currentPrice - nearestSupport) / currentPrice;
    const distToResistance = (nearestResistance - currentPrice) / currentPrice;
    if (distToSupport < 0.02) srScore = 50; // Near support = buy zone
    else if (distToResistance < 0.02) srScore = -50; // Near resistance = sell zone
    else srScore = (distToResistance - distToSupport) * 1000;
  }
  indicators.push({ name: "Support/Résistance", score: clamp(Math.round(srScore), -100, 100), signal: toSignal(srScore), description: nearestSupport ? `Support: ${nearestSupport.toFixed(2)}, Résistance: ${(nearestResistance || 0).toFixed(2)}` : "Niveaux en calcul" });

  const avgScore = indicators.reduce((sum, ind) => sum + ind.score, 0) / indicators.length;
  return { category: "Support/Résistance", weight: 0.10, score: Math.round(avgScore), signal: toSignal(avgScore), indicators };
}

// ============================================
// Main scoring function
// ============================================
export function computeAISignal(candles: OHLCV[]): AISignalResult {
  if (candles.length < 30) {
    return {
      globalScore: 0,
      signal: "NEUTRAL",
      confidence: 0,
      categories: [],
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      bullishReasons: ["Données insuffisantes"],
      bearishReasons: ["Données insuffisantes"],
    };
  }

  const categories = [
    scoreTrend(candles),
    scoreMomentum(candles),
    scoreVolume(candles),
    scoreVolatility(candles),
    scoreSupportResistance(candles),
  ];

  // Weighted average
  const globalScore = Math.round(
    categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
  );

  // Confidence: how much indicators agree (low std dev = high confidence)
  const allScores = categories.flatMap((cat) => cat.indicators.map((i) => i.score));
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / allScores.length;
  const stdDevVal = Math.sqrt(variance);
  const confidence = Math.round(clamp(100 - stdDevVal, 20, 95));

  // Entry, SL, TP
  const currentPrice = candles[candles.length - 1].close;
  const atrVal = last(atr(candles));
  const atrSafe = isNaN(atrVal) ? currentPrice * 0.02 : atrVal;

  const entryPrice = currentPrice;
  const stopLoss = globalScore > 0
    ? currentPrice - 2 * atrSafe
    : currentPrice + 2 * atrSafe;
  const takeProfit = globalScore > 0
    ? currentPrice + 3 * atrSafe
    : currentPrice - 3 * atrSafe;

  // Top reasons
  const allIndicators = categories.flatMap((cat) => cat.indicators);
  const sorted = [...allIndicators].sort((a, b) => b.score - a.score);
  const bullishReasons = sorted
    .filter((i) => i.score > 20)
    .slice(0, 3)
    .map((i) => `${i.name}: ${i.description}`);
  const bearishReasons = sorted
    .filter((i) => i.score < -20)
    .slice(-3)
    .reverse()
    .map((i) => `${i.name}: ${i.description}`);

  if (bullishReasons.length === 0) bullishReasons.push("Aucun signal haussier fort");
  if (bearishReasons.length === 0) bearishReasons.push("Aucun signal baissier fort");

  return {
    globalScore,
    signal: toSignal(globalScore),
    confidence,
    categories,
    entryPrice,
    stopLoss,
    takeProfit,
    bullishReasons,
    bearishReasons,
  };
}
