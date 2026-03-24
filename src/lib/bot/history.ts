// ============================================
// Bot History Generator — Creates realistic initial trade history
// ============================================

import type {
  BotConfig,
  ClosedTrade,
  PortfolioPoint,
  TradedCrypto,
  TradeDirection,
  TradeCloseReason,
  LogEntry,
} from "./types";
import { STRATEGIES } from "./types";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

// Approximate prices for 7 days ago (used as base)
const BASE_PRICES: Record<TradedCrypto, number> = {
  BTCUSDT: 68000,
  ETHUSDT: 2400,
  SOLUSDT: 140,
};

// Simulate price variation from base
function simulatePrice(base: number, dayOffset: number): number {
  const drift = (Math.random() - 0.48) * 0.02 * dayOffset;
  const noise = (Math.random() - 0.5) * 0.03;
  return base * (1 + drift + noise);
}

const CLOSE_REASONS_WIN: TradeCloseReason[] = ["take_profit", "trailing_stop", "signal_reversed"];
const CLOSE_REASONS_LOSS: TradeCloseReason[] = ["stop_loss", "stop_loss", "signal_reversed"];

export function generateInitialHistory(config: BotConfig): {
  history: ClosedTrade[];
  curve: PortfolioPoint[];
  logs: LogEntry[];
  finalValue: number;
  peakValue: number;
} {
  const strat = STRATEGIES[config.strategy];
  const totalTrades = 50;
  const winRate = strat.targetWinRate / 100;

  // Generate win/loss sequence with streaks
  const results: boolean[] = [];
  let streakCount = 0;
  let lastWin = Math.random() > 0.5;

  for (let i = 0; i < totalTrades; i++) {
    // Tendency to continue streaks
    const streakProb = Math.min(0.7, 0.4 + streakCount * 0.05);
    if (Math.random() < streakProb && streakCount < 5) {
      results.push(lastWin);
      streakCount++;
    } else {
      const isWin = Math.random() < winRate;
      results.push(isWin);
      lastWin = isWin;
      streakCount = 1;
    }
  }

  // Adjust to match target win rate roughly
  const wins = results.filter(Boolean).length;
  const targetWins = Math.round(totalTrades * winRate);
  const diff = targetWins - wins;
  if (diff > 0) {
    let fixed = 0;
    for (let i = 0; i < results.length && fixed < diff; i++) {
      if (!results[i]) { results[i] = true; fixed++; }
    }
  } else if (diff < 0) {
    let fixed = 0;
    for (let i = results.length - 1; i >= 0 && fixed < -diff; i--) {
      if (results[i]) { results[i] = false; fixed++; }
    }
  }

  // Distribute cryptos: BTC 50%, ETH 30%, SOL 20%
  const cryptoDistribution: TradedCrypto[] = [];
  for (let i = 0; i < totalTrades; i++) {
    const r = Math.random();
    if (r < 0.5) cryptoDistribution.push("BTCUSDT");
    else if (r < 0.8) cryptoDistribution.push("ETHUSDT");
    else cryptoDistribution.push("SOLUSDT");
  }

  // Generate trades over 7 days
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const timeSlotSize = (now - sevenDaysAgo) / totalTrades;

  const history: ClosedTrade[] = [];
  const curve: PortfolioPoint[] = [];
  const logs: LogEntry[] = [];
  let portfolio = config.initialCapital;
  let peak = portfolio;

  curve.push({ t: sevenDaysAgo, v: portfolio });

  for (let i = 0; i < totalTrades; i++) {
    const isWin = results[i];
    const crypto = cryptoDistribution[i];
    const basePrice = BASE_PRICES[crypto];
    const dayOffset = (i / totalTrades) * 7;
    const entryPrice = simulatePrice(basePrice, dayOffset);

    const direction: TradeDirection = Math.random() > 0.45 ? "LONG" : "SHORT";
    const positionSize = portfolio * (strat.positionSizePct / 100) * randomBetween(0.7, 1.0);

    let pnlPct: number;
    let closeReason: TradeCloseReason;

    if (isWin) {
      pnlPct = randomBetween(strat.takeProfitPct * 0.4, strat.takeProfitPct);
      closeReason = CLOSE_REASONS_WIN[randomInt(0, 2)];
    } else {
      pnlPct = -randomBetween(strat.stopLossPct * 0.5, strat.stopLossPct);
      closeReason = CLOSE_REASONS_LOSS[randomInt(0, 2)];
    }

    // Apply spread/slippage
    pnlPct -= 0.06; // ~0.06% costs

    const pnl = positionSize * (pnlPct / 100);
    const exitPrice = direction === "LONG"
      ? entryPrice * (1 + pnlPct / 100)
      : entryPrice * (1 - pnlPct / 100);

    const entryTime = sevenDaysAgo + i * timeSlotSize + randomBetween(0, timeSlotSize * 0.5);
    const durationMs = randomBetween(15 * 60 * 1000, 12 * 60 * 60 * 1000);
    const exitTime = entryTime + durationMs;

    const trade: ClosedTrade = {
      id: uid(),
      tradeNumber: i + 1,
      crypto,
      direction,
      entryPrice,
      exitPrice,
      entryTime,
      exitTime,
      size: positionSize,
      pnl,
      pnlPct,
      result: isWin ? "win" : "loss",
      closeReason,
    };

    history.push(trade);
    portfolio += pnl;
    if (portfolio > peak) peak = portfolio;

    // Add curve points
    curve.push({ t: entryTime, v: portfolio - pnl * 0.5 });
    curve.push({ t: exitTime, v: portfolio });

    // Log
    const label = crypto === "BTCUSDT" ? "BTC" : crypto === "ETHUSDT" ? "ETH" : "SOL";
    logs.push({
      id: uid(),
      timestamp: exitTime,
      type: "close",
      message: `${isWin ? "\u{1F4B0}" : "\u{1F6D1}"} CLOSE ${direction} ${label} @ $${exitPrice.toFixed(2)} \u2014 P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} \u2014 ${closeReason === "take_profit" ? "Take Profit atteint" : closeReason === "stop_loss" ? "Stop Loss touch\u00e9" : closeReason === "trailing_stop" ? "Trailing Stop d\u00e9clench\u00e9" : "Signal IA invers\u00e9"}`,
    });
  }

  // Ensure positive outcome (+5% to +12%)
  const targetPnlPct = randomBetween(5, 12);
  const targetValue = config.initialCapital * (1 + targetPnlPct / 100);
  const scaleFactor = (targetValue - config.initialCapital) / (portfolio - config.initialCapital);

  if (Math.abs(scaleFactor) < 10 && scaleFactor > 0) {
    for (const trade of history) {
      trade.pnl *= scaleFactor;
    }
    // Recalculate portfolio and curve
    portfolio = config.initialCapital;
    peak = portfolio;
    const newCurve: PortfolioPoint[] = [{ t: sevenDaysAgo, v: portfolio }];
    for (const trade of history) {
      portfolio += trade.pnl;
      if (portfolio > peak) peak = portfolio;
      newCurve.push({ t: trade.entryTime, v: portfolio - trade.pnl * 0.5 });
      newCurve.push({ t: trade.exitTime, v: portfolio });
    }
    curve.length = 0;
    curve.push(...newCurve);
  }

  // Add final point
  curve.push({ t: now, v: portfolio });

  return { history, curve, logs: logs.slice(-100), finalValue: portfolio, peakValue: peak };
}
