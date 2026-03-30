// ============================================
// Backtest Web Worker — Runs simulation in background thread
// Receives OHLCV data + config, returns trades + stats + curve
// Posts progress messages to main thread
// ============================================

"use strict";

// ---- Indicator helpers ----

function calculateSMA(closes, period) {
  if (closes.length < period) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

function calculateEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes, period) {
  if (closes.length < period + 1) return 50;
  let gainSum = 0, lossSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMACD(closes) {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  if (ema12 === null || ema26 === null) return { macd: 0, signal: 0, histogram: 0 };
  const macdLine = ema12 - ema26;
  // Approximate signal as EMA of recent MACD values
  return { macd: macdLine, signal: macdLine * 0.8, histogram: macdLine * 0.2 };
}

function calculateATR(data, period) {
  if (data.length < period + 1) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    sum += tr;
  }
  return sum / period;
}

function calculateBollingerBands(closes, period, mult) {
  const sma = calculateSMA(closes, period);
  if (sma === null) return null;
  const slice = closes.slice(-period);
  const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: sma + mult * stdDev, middle: sma, lower: sma - mult * stdDev };
}

// ---- Scoring engine (mirrors server-side logic) ----

function computeScore(data, index) {
  const lookback = Math.min(index + 1, 100);
  const slice = data.slice(index + 1 - lookback, index + 1);
  const closes = slice.map(d => d.close);
  if (closes.length < 20) return { score: 0, confidence: 30 };

  const currentPrice = closes[closes.length - 1];
  let totalScore = 0;
  let components = 0;

  // RSI
  const rsi = calculateRSI(closes, 14);
  let rsiScore = 0;
  if (rsi < 30) rsiScore = 60;
  else if (rsi < 40) rsiScore = 30;
  else if (rsi < 60) rsiScore = 0;
  else if (rsi < 70) rsiScore = -30;
  else rsiScore = -60;
  totalScore += rsiScore;
  components++;

  // SMA crossover
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, Math.min(50, closes.length));
  let smaScore = 0;
  if (sma20 !== null) {
    smaScore += currentPrice > sma20 ? 25 : -25;
    if (sma50 !== null) {
      smaScore += sma20 > sma50 ? 20 : -20;
    }
  }
  totalScore += smaScore;
  components++;

  // MACD
  const macd = calculateMACD(closes);
  let macdScore = 0;
  if (macd.macd > 0) macdScore += 25;
  else macdScore -= 25;
  if (macd.histogram > 0) macdScore += 15;
  else macdScore -= 15;
  totalScore += macdScore;
  components++;

  // Momentum (5-period ROC)
  if (closes.length >= 6) {
    const roc = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
    const momScore = Math.max(-50, Math.min(50, roc * 8));
    totalScore += momScore;
    components++;
  }

  // Bollinger Bands position
  const bb = calculateBollingerBands(closes, 20, 2);
  if (bb) {
    const bbRange = bb.upper - bb.lower;
    if (bbRange > 0) {
      const pos = (currentPrice - bb.lower) / bbRange;
      let bbScore = 0;
      if (pos < 0.2) bbScore = 50;
      else if (pos > 0.8) bbScore = -50;
      else bbScore = (0.5 - pos) * 80;
      totalScore += bbScore;
      components++;
    }
  }

  // Volume trend (if available)
  if (slice.length >= 10 && slice[slice.length - 1].volume > 0) {
    const recentVol = slice.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
    const olderVol = slice.slice(-10, -5).reduce((s, d) => s + d.volume, 0) / 5;
    if (olderVol > 0) {
      const volRatio = recentVol / olderVol;
      let volScore = 0;
      if (volRatio > 1.5) volScore = currentPrice > closes[closes.length - 6] ? 30 : -30;
      else if (volRatio > 1) volScore = 10;
      else volScore = -10;
      totalScore += volScore;
      components++;
    }
  }

  const avgScore = components > 0 ? totalScore / components : 0;
  const clamped = Math.max(-100, Math.min(100, Math.round(avgScore)));

  // Confidence: how extreme the score is
  const confidence = Math.min(90, 30 + Math.abs(clamped) * 0.6);

  return { score: clamped, confidence: Math.round(confidence) };
}

// ---- Strategy params ----
const STRATEGY_PARAMS = {
  conservative: { label: "Conservative", threshold: 60, slPct: 1.5, tpPct: 2.5, sizePct: 10 },
  balanced: { label: "Balanced", threshold: 35, slPct: 2.5, tpPct: 4.0, sizePct: 15 },
  aggressive: { label: "Aggressive", threshold: 20, slPct: 4.0, tpPct: 6.0, sizePct: 25 },
};

// ---- Main backtest function ----

function runBacktest(ohlcData, config) {
  const strat = STRATEGY_PARAMS[config.strategy] || STRATEGY_PARAMS.balanced;
  const capital = config.capital || 10000;
  let portfolioValue = capital;
  let peakValue = capital;
  let maxDrawdown = 0;

  const trades = [];
  const portfolioCurve = [{ t: ohlcData[0]?.timestamp || 0, v: capital }];
  const openPositions = [];
  const lastTradeTime = {};
  let consecutiveLosses = 0;
  let tradeNum = 0;

  const totalPoints = ohlcData.length;

  for (let i = 20; i < totalPoints; i++) {
    const candle = ohlcData[i];
    const currentPrice = candle.close;
    const highPrice = candle.high;
    const lowPrice = candle.low;
    const timestamp = candle.timestamp;

    // ---- Check open positions (SL/TP/trailing) ----
    for (let p = openPositions.length - 1; p >= 0; p--) {
      const pos = openPositions[p];
      const slPrice = pos.trailingStop || pos.stopLoss;
      let closed = false;
      let exitPrice, closeReason;

      // Stop loss check
      if (pos.direction === "LONG" && lowPrice <= slPrice) {
        exitPrice = slPrice * (1 - 0.0005);
        closeReason = pos.trailingStop ? "trailing_stop" : "stop_loss";
        closed = true;
      } else if (pos.direction === "SHORT" && highPrice >= slPrice) {
        exitPrice = slPrice * (1 + 0.0005);
        closeReason = pos.trailingStop ? "trailing_stop" : "stop_loss";
        closed = true;
      }

      // Take profit check
      if (!closed) {
        if (pos.direction === "LONG" && highPrice >= pos.takeProfit) {
          exitPrice = pos.takeProfit * (1 - 0.0005);
          closeReason = "take_profit";
          closed = true;
        } else if (pos.direction === "SHORT" && lowPrice <= pos.takeProfit) {
          exitPrice = pos.takeProfit * (1 + 0.0005);
          closeReason = "take_profit";
          closed = true;
        }
      }

      if (closed) {
        const diff = pos.direction === "LONG"
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnl = Math.round(pos.size * diff * 100) / 100;
        const pnlPct = Math.round(diff * 10000) / 100;
        const result = pnl >= 0 ? "win" : "loss";

        trades.push({
          id: ++tradeNum,
          crypto: pos.crypto,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: Math.round(exitPrice * 100) / 100,
          entryTime: pos.entryTime,
          exitTime: timestamp,
          size: pos.size,
          pnl,
          pnlPct,
          result,
          closeReason,
        });

        portfolioValue += pnl;
        if (result === "loss") consecutiveLosses++;
        else consecutiveLosses = 0;

        openPositions.splice(p, 1);
        continue;
      }

      // Update trailing stop
      if (config.trailingStop && pos.trailingStop !== null) {
        if (pos.direction === "LONG" && highPrice > pos.entryPrice) {
          const newTS = highPrice * (1 - strat.slPct / 100);
          if (newTS > pos.trailingStop) pos.trailingStop = newTS;
        } else if (pos.direction === "SHORT" && lowPrice < pos.entryPrice) {
          const newTS = lowPrice * (1 + strat.slPct / 100);
          if (newTS < pos.trailingStop) pos.trailingStop = newTS;
        }
      }
    }

    // ---- Evaluate new entries ----
    const { score, confidence } = computeScore(ohlcData, i);
    const absScore = Math.abs(score);

    if (absScore >= strat.threshold && openPositions.length < (config.maxConcurrentTrades || 3)) {
      // Cooldown check
      const cooldownMs = (config.cooldownMinutes || 15) * 60000;
      const lastTime = lastTradeTime["all"] || 0;
      if (timestamp - lastTime < cooldownMs && lastTime > 0) {
        // Skip — cooldown
      }
      // Tilt protection
      else if (consecutiveLosses >= 3) {
        // Skip — tilt
      }
      else {
        let direction = null;
        if (score > strat.threshold) direction = "LONG";
        else if (score < -strat.threshold) direction = "SHORT";

        if (direction) {
          const sizePct = strat.sizePct / 100;
          const size = Math.round(portfolioValue * sizePct);
          const spread = 0.0005;

          const entryPrice = direction === "LONG"
            ? currentPrice * (1 + spread)
            : currentPrice * (1 - spread);

          const stopLoss = direction === "LONG"
            ? entryPrice * (1 - strat.slPct / 100)
            : entryPrice * (1 + strat.slPct / 100);

          const takeProfit = direction === "LONG"
            ? entryPrice * (1 + strat.tpPct / 100)
            : entryPrice * (1 - strat.tpPct / 100);

          openPositions.push({
            crypto: config.cryptoLabel || "BTC",
            direction,
            entryPrice: Math.round(entryPrice * 100) / 100,
            entryTime: timestamp,
            size,
            stopLoss,
            takeProfit,
            trailingStop: config.trailingStop ? stopLoss : null,
          });

          lastTradeTime["all"] = timestamp;
        }
      }
    }

    // ---- Portfolio value ----
    let openPnl = 0;
    for (const pos of openPositions) {
      if (pos.direction === "LONG") {
        openPnl += ((currentPrice - pos.entryPrice) / pos.entryPrice) * pos.size;
      } else {
        openPnl += ((pos.entryPrice - currentPrice) / pos.entryPrice) * pos.size;
      }
    }

    const closedPnl = trades.reduce((s, t) => s + t.pnl, 0);
    portfolioValue = capital + closedPnl + openPnl;

    if (portfolioValue > peakValue) peakValue = portfolioValue;
    const dd = peakValue > 0 ? ((peakValue - portfolioValue) / peakValue) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    // Add curve point every few candles
    if (i % 3 === 0 || i === totalPoints - 1) {
      portfolioCurve.push({ t: timestamp, v: Math.round(portfolioValue * 100) / 100 });
    }

    // Max drawdown auto-stop
    if (dd > (config.maxDrawdown || 15)) {
      for (let p = openPositions.length - 1; p >= 0; p--) {
        const pos = openPositions[p];
        const exitPrice = currentPrice;
        const diff = pos.direction === "LONG"
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnl = Math.round(pos.size * diff * 100) / 100;
        trades.push({
          id: ++tradeNum,
          crypto: pos.crypto,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice: Math.round(exitPrice * 100) / 100,
          entryTime: pos.entryTime,
          exitTime: timestamp,
          size: pos.size,
          pnl,
          pnlPct: Math.round(diff * 10000) / 100,
          result: pnl >= 0 ? "win" : "loss",
          closeReason: "max_drawdown",
        });
        openPositions.splice(p, 1);
      }
      portfolioCurve.push({ t: timestamp, v: Math.round(portfolioValue * 100) / 100 });
      break;
    }

    // Progress
    if (i % 100 === 0) {
      self.postMessage({ type: "progress", value: Math.round((i / totalPoints) * 100), trades: trades.length });
    }
  }

  // Close remaining positions at last price
  if (openPositions.length > 0) {
    const lastCandle = ohlcData[ohlcData.length - 1];
    for (const pos of openPositions) {
      const diff = pos.direction === "LONG"
        ? (lastCandle.close - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - lastCandle.close) / pos.entryPrice;
      const pnl = Math.round(pos.size * diff * 100) / 100;
      trades.push({
        id: ++tradeNum,
        crypto: pos.crypto,
        direction: pos.direction,
        entryPrice: pos.entryPrice,
        exitPrice: Math.round(lastCandle.close * 100) / 100,
        entryTime: pos.entryTime,
        exitTime: lastCandle.timestamp,
        size: pos.size,
        pnl,
        pnlPct: Math.round(diff * 10000) / 100,
        result: pnl >= 0 ? "win" : "loss",
        closeReason: "end_of_period",
      });
    }
  }

  // ---- Compute stats ----
  const wins = trades.filter(t => t.result === "win");
  const losses = trades.filter(t => t.result === "loss");
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const bestTrade = trades.length > 0 ? trades.reduce((best, t) => t.pnl > best.pnl ? t : best, trades[0]) : null;
  const worstTrade = trades.length > 0 ? trades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, trades[0]) : null;

  // Profit factor
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : wins.length > 0 ? 999 : 0;

  // Sharpe ratio (simplified: annualized return / annualized vol)
  let sharpeRatio = 0;
  if (portfolioCurve.length > 5) {
    const returns = [];
    for (let i = 1; i < portfolioCurve.length; i++) {
      if (portfolioCurve[i - 1].v > 0) {
        returns.push((portfolioCurve[i].v - portfolioCurve[i - 1].v) / portfolioCurve[i - 1].v);
      }
    }
    if (returns.length > 1) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        sharpeRatio = Math.round((meanReturn / stdDev) * Math.sqrt(252) * 100) / 100;
      }
    }
  }

  // Win/loss streaks
  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.result === "win") { curWin++; curLoss = 0; if (curWin > maxWinStreak) maxWinStreak = curWin; }
    else { curLoss++; curWin = 0; if (curLoss > maxLossStreak) maxLossStreak = curLoss; }
  }

  // Average trade duration
  const avgDuration = trades.length > 0
    ? trades.reduce((s, t) => s + (t.exitTime - t.entryTime), 0) / trades.length
    : 0;

  // Expected value per trade
  const expectedValue = trades.length > 0 ? Math.round((totalPnl / trades.length) * 100) / 100 : 0;

  return {
    trades,
    portfolioCurve,
    stats: {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      totalReturn: Math.round((totalPnl / capital) * 10000) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      bestTrade: bestTrade ? { pnl: bestTrade.pnl, crypto: bestTrade.crypto, direction: bestTrade.direction } : null,
      worstTrade: worstTrade ? { pnl: worstTrade.pnl, crypto: worstTrade.crypto, direction: worstTrade.direction } : null,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio,
      profitFactor,
      avgDurationMs: avgDuration,
      avgDurationLabel: formatDuration(avgDuration),
      maxWinStreak,
      maxLossStreak,
      expectedValue,
    },
  };
}

function formatDuration(ms) {
  if (ms <= 0) return "0h";
  const hours = ms / 3600000;
  if (hours < 1) return Math.round(hours * 60) + "m";
  if (hours < 24) return hours.toFixed(1) + "h";
  return (hours / 24).toFixed(1) + "d";
}

// ---- Worker message handler ----

self.onmessage = function (e) {
  const { type, ohlcData, config } = e.data;

  if (type === "run") {
    self.postMessage({ type: "progress", value: 0, trades: 0 });

    try {
      const results = runBacktest(ohlcData, config);
      self.postMessage({ type: "complete", data: results });
    } catch (err) {
      self.postMessage({ type: "error", error: err.message || String(err) });
    }
  }
};
