// ============================================
// Bot Trading Engine — Decision making and trade execution
// ============================================

import type {
  BotConfig,
  BotState,
  OpenPosition,
  ClosedTrade,
  LogEntry,
  PortfolioPoint,
  TradedCrypto,
  TradeDirection,
  TradeCloseReason,
} from "./types";
import { STRATEGIES, TRADED_CRYPTOS } from "./types";
import { fetchOHLCV } from "@/lib/binance";
import { computeAISignal } from "@/lib/indicators/scoring";
import type { AISignalResult } from "@/lib/indicators/types";

// ---- Helpers ----

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function spread(): number {
  return 0.0005; // 0.05%
}

function slippage(): number {
  return 0.0001 + Math.random() * 0.0009; // 0.01% to 0.1%
}

function applySpreadAndSlippage(price: number, direction: TradeDirection, isEntry: boolean): number {
  const s = spread() + slippage();
  // Entry: worse price, Exit: worse price
  if (direction === "LONG") {
    return isEntry ? price * (1 + s) : price * (1 - s);
  }
  return isEntry ? price * (1 - s) : price * (1 + s);
}

export function computePnl(pos: OpenPosition, currentPrice: number): { pnl: number; pnlPct: number } {
  const exitPrice = applySpreadAndSlippage(currentPrice, pos.direction, false);
  const diff = pos.direction === "LONG"
    ? (exitPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - exitPrice) / pos.entryPrice;
  const pnl = pos.size * diff;
  const pnlPct = diff * 100;
  return { pnl, pnlPct };
}

// ---- Price fetching ----

export interface CryptoSnapshot {
  price: number;
  signal: AISignalResult;
}

const signalCache: Record<string, { signal: AISignalResult; ts: number }> = {};
const SIGNAL_CACHE_TTL = 25_000;

export async function fetchCryptoSnapshots(
  enabledCryptos: Record<TradedCrypto, boolean>,
): Promise<Record<TradedCrypto, CryptoSnapshot>> {
  const result: Partial<Record<TradedCrypto, CryptoSnapshot>> = {};

  const enabled = TRADED_CRYPTOS.filter((c) => enabledCryptos[c.symbol]);

  await Promise.all(
    enabled.map(async (crypto) => {
      try {
        const cached = signalCache[crypto.symbol];
        if (cached && Date.now() - cached.ts < SIGNAL_CACHE_TTL) {
          // Use cached signal but get fresh price from latest candle
          const candles = await fetchOHLCV(crypto.symbol, "1H", 50);
          const price = candles.length > 0 ? candles[candles.length - 1].close : 0;
          result[crypto.symbol] = { price, signal: cached.signal };
          return;
        }

        const candles = await fetchOHLCV(crypto.symbol, "1H", 100);
        if (candles.length < 30) return;

        const price = candles[candles.length - 1].close;
        const signal = computeAISignal(candles);
        signalCache[crypto.symbol] = { signal, ts: Date.now() };
        result[crypto.symbol] = { price, signal };
      } catch {
        // Skip this crypto on error
      }
    }),
  );

  return result as Record<TradedCrypto, CryptoSnapshot>;
}

// ---- Decision engine ----

interface TradeDecision {
  action: "open_long" | "open_short" | "none";
  score: number;
  reasons: string[];
}

export function evaluateEntry(
  signal: AISignalResult,
  config: BotConfig,
): TradeDecision {
  const strat = STRATEGIES[config.strategy];
  const score = signal.globalScore;
  const absScore = Math.abs(score);

  if (absScore < strat.scoreThreshold) {
    return { action: "none", score, reasons: ["Score sous le seuil"] };
  }

  // Extract indicator values from categories
  const momentum = signal.categories.find((c) => c.category === "Momentum");
  const trend = signal.categories.find((c) => c.category === "Tendance" || c.category === "Trend");
  const volume = signal.categories.find((c) => c.category === "Volume");

  const rsiIndicator = momentum?.indicators.find((i) => i.name === "RSI");
  const macdIndicator = trend?.indicators.find((i) => i.name === "MACD");
  const smaIndicator = trend?.indicators.find((i) => i.name.includes("SMA") || i.name.includes("EMA"));
  const volumeIndicator = volume?.indicators.find((i) => i.name.includes("Volume") || i.name.includes("OBV"));

  const rsiScore = rsiIndicator?.score ?? 0;
  const macdScore = macdIndicator?.score ?? 0;
  const smaScore = smaIndicator?.score ?? 0;
  const volumeScore = volumeIndicator?.score ?? 0;

  if (score > strat.scoreThreshold) {
    // Long conditions
    const conditions: boolean[] = [
      score > strat.scoreThreshold,
      rsiScore > -50, // RSI not overbought
      macdScore > -10, // MACD positive or crossing
      smaScore > -20, // Price above SMA
      volumeScore > -20, // Volume above average
    ];
    const trueCount = conditions.filter(Boolean).length;
    const reasons: string[] = [];
    if (conditions[0]) reasons.push(`Score IA: +${score}`);
    if (conditions[1]) reasons.push("RSI favorable");
    if (conditions[2]) reasons.push("MACD positif");
    if (conditions[3]) reasons.push("Prix > SMA");
    if (conditions[4]) reasons.push("Volume élevé");

    if (trueCount >= 3) {
      return { action: "open_long", score, reasons };
    }
    return { action: "none", score, reasons: [`Seulement ${trueCount}/5 conditions (min 3)`] };
  }

  if (score < -strat.scoreThreshold) {
    // Short conditions
    const conditions: boolean[] = [
      score < -strat.scoreThreshold,
      rsiScore < 50, // RSI not oversold
      macdScore < 10, // MACD negative
      smaScore < 20, // Price below SMA
      volumeScore > -20, // Volume above average
    ];
    const trueCount = conditions.filter(Boolean).length;
    const reasons: string[] = [];
    if (conditions[0]) reasons.push(`Score IA: ${score}`);
    if (conditions[1]) reasons.push("RSI favorable");
    if (conditions[2]) reasons.push("MACD négatif");
    if (conditions[3]) reasons.push("Prix < SMA");
    if (conditions[4]) reasons.push("Volume élevé");

    if (trueCount >= 3) {
      return { action: "open_short", score, reasons };
    }
    return { action: "none", score, reasons: [`Seulement ${trueCount}/5 conditions (min 3)`] };
  }

  return { action: "none", score, reasons: ["Pas de signal clair"] };
}

// ---- Trade execution ----

export function openPosition(
  crypto: TradedCrypto,
  direction: TradeDirection,
  price: number,
  config: BotConfig,
  portfolioValue: number,
): OpenPosition {
  const strat = STRATEGIES[config.strategy];
  const allocation = config.allocations[crypto] / 100;
  const maxSize = portfolioValue * (strat.positionSizePct / 100) * allocation * (100 / Math.max(config.allocations[crypto], 1));
  const size = Math.min(maxSize, portfolioValue * (strat.positionSizePct / 100));

  const entryPrice = applySpreadAndSlippage(price, direction, true);

  const stopLoss = direction === "LONG"
    ? entryPrice * (1 - strat.stopLossPct / 100)
    : entryPrice * (1 + strat.stopLossPct / 100);

  const takeProfit = direction === "LONG"
    ? entryPrice * (1 + strat.takeProfitPct / 100)
    : entryPrice * (1 - strat.takeProfitPct / 100);

  return {
    id: uid(),
    crypto,
    direction,
    entryPrice,
    entryTime: Date.now(),
    size,
    stopLoss,
    takeProfit,
    trailingStopPrice: config.trailingStop ? stopLoss : null,
    currentPrice: price,
    pnl: 0,
    pnlPct: 0,
  };
}

export interface CloseResult {
  trade: ClosedTrade;
  reason: TradeCloseReason;
}

export function closePosition(
  pos: OpenPosition,
  currentPrice: number,
  reason: TradeCloseReason,
  tradeNumber: number,
): ClosedTrade {
  const exitPrice = applySpreadAndSlippage(currentPrice, pos.direction, false);
  const diff = pos.direction === "LONG"
    ? (exitPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - exitPrice) / pos.entryPrice;
  const pnl = pos.size * diff;

  return {
    id: pos.id,
    tradeNumber,
    crypto: pos.crypto,
    direction: pos.direction,
    entryPrice: pos.entryPrice,
    exitPrice,
    entryTime: pos.entryTime,
    exitTime: Date.now(),
    size: pos.size,
    pnl,
    pnlPct: diff * 100,
    result: pnl >= 0 ? "win" : "loss",
    closeReason: reason,
  };
}

// ---- Position management ----

export interface TickResult {
  updatedPositions: OpenPosition[];
  closedTrades: ClosedTrade[];
  logs: LogEntry[];
  newPositions: OpenPosition[];
}

export function tickPositions(
  positions: OpenPosition[],
  snapshots: Record<TradedCrypto, CryptoSnapshot>,
  config: BotConfig,
  nextTradeNumber: number,
): TickResult {
  const updatedPositions: OpenPosition[] = [];
  const closedTrades: ClosedTrade[] = [];
  const logs: LogEntry[] = [];
  let tradeNum = nextTradeNumber;

  for (const pos of positions) {
    const snap = snapshots[pos.crypto];
    if (!snap) {
      updatedPositions.push(pos);
      continue;
    }

    const currentPrice = snap.price;
    const { pnl, pnlPct } = computePnl(pos, currentPrice);

    // Check stop loss
    const hitSL = pos.direction === "LONG"
      ? currentPrice <= (pos.trailingStopPrice ?? pos.stopLoss)
      : currentPrice >= (pos.trailingStopPrice ?? pos.stopLoss);

    if (hitSL) {
      const trade = closePosition(pos, currentPrice, pos.trailingStopPrice ? "trailing_stop" : "stop_loss", tradeNum++);
      closedTrades.push(trade);
      const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
      logs.push({
        id: uid(),
        timestamp: Date.now(),
        type: "close",
        message: `🛑 CLOSE ${pos.direction} ${label} @ $${currentPrice.toFixed(2)} — P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)} — ${pos.trailingStopPrice ? "Trailing stop" : "Stop loss"} touché`,
      });
      continue;
    }

    // Check take profit
    const hitTP = pos.direction === "LONG"
      ? currentPrice >= pos.takeProfit
      : currentPrice <= pos.takeProfit;

    if (hitTP) {
      const trade = closePosition(pos, currentPrice, "take_profit", tradeNum++);
      closedTrades.push(trade);
      const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
      logs.push({
        id: uid(),
        timestamp: Date.now(),
        type: "close",
        message: `💰 CLOSE ${pos.direction} ${label} @ $${currentPrice.toFixed(2)} — P&L: +$${trade.pnl.toFixed(2)} — Take Profit atteint!`,
      });
      continue;
    }

    // Check signal reversal
    const score = snap.signal.globalScore;
    const reversed = (pos.direction === "LONG" && score < -30) || (pos.direction === "SHORT" && score > 30);
    if (reversed) {
      const trade = closePosition(pos, currentPrice, "signal_reversed", tradeNum++);
      closedTrades.push(trade);
      const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
      logs.push({
        id: uid(),
        timestamp: Date.now(),
        type: "close",
        message: `🔄 CLOSE ${pos.direction} ${label} @ $${currentPrice.toFixed(2)} — P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)} — Signal IA inversé`,
      });
      continue;
    }

    // Update trailing stop
    let trailingStopPrice = pos.trailingStopPrice;
    if (config.trailingStop && trailingStopPrice !== null) {
      if (pos.direction === "LONG" && currentPrice > pos.entryPrice) {
        const newTS = currentPrice * (1 - STRATEGIES[config.strategy].stopLossPct / 100);
        if (newTS > trailingStopPrice) {
          trailingStopPrice = newTS;
          const label = TRADED_CRYPTOS.find((c) => c.symbol === pos.crypto)?.label ?? pos.crypto;
          logs.push({
            id: uid(),
            timestamp: Date.now(),
            type: "update",
            message: `📊 ${label} ${pos.direction} — Trailing stop ajusté: $${(pos.trailingStopPrice ?? 0).toFixed(2)} → $${newTS.toFixed(2)}`,
          });
        }
      } else if (pos.direction === "SHORT" && currentPrice < pos.entryPrice) {
        const newTS = currentPrice * (1 + STRATEGIES[config.strategy].stopLossPct / 100);
        if (newTS < trailingStopPrice) {
          trailingStopPrice = newTS;
        }
      }
    }

    // Update position
    updatedPositions.push({
      ...pos,
      currentPrice,
      pnl,
      pnlPct,
      trailingStopPrice,
    });
  }

  return { updatedPositions, closedTrades, logs, newPositions: [] };
}

// ---- Main tick (full cycle) ----

export interface FullTickResult {
  positions: OpenPosition[];
  closedTrades: ClosedTrade[];
  logs: LogEntry[];
  portfolioValue: number;
  snapshots: Record<TradedCrypto, CryptoSnapshot>;
}

export async function runTick(
  config: BotConfig,
  state: BotState,
  positions: OpenPosition[],
  history: ClosedTrade[],
): Promise<FullTickResult> {
  const logs: LogEntry[] = [];
  const now = Date.now();

  // 1. Fetch snapshots
  const snapshots = await fetchCryptoSnapshots(config.enabledCryptos);

  // 2. Tick existing positions
  const nextTradeNumber = history.length + 1;
  const tickResult = tickPositions(positions, snapshots, config, nextTradeNumber);
  logs.push(...tickResult.logs);

  let currentPositions = tickResult.updatedPositions;
  const closedTrades = tickResult.closedTrades;

  // 3. Evaluate new entries for each crypto
  const enabledCryptos = TRADED_CRYPTOS.filter((c) => config.enabledCryptos[c.symbol]);

  for (const crypto of enabledCryptos) {
    const snap = snapshots[crypto.symbol];
    if (!snap) continue;

    const hasPosition = currentPositions.some((p) => p.crypto === crypto.symbol);
    if (hasPosition) {
      logs.push({
        id: uid(),
        timestamp: now,
        type: "scan",
        message: `\u{1F50D} Scan ${crypto.label} \u2014 Score IA: ${snap.signal.globalScore > 0 ? "+" : ""}${snap.signal.globalScore} \u2014 Position ouverte, skip`,
      });
      continue;
    }

    // Check max concurrent
    if (currentPositions.length >= config.maxConcurrentTrades) {
      logs.push({
        id: uid(),
        timestamp: now,
        type: "scan",
        message: `\u{1F50D} Scan ${crypto.label} \u2014 Max trades atteint (${currentPositions.length}/${config.maxConcurrentTrades})`,
      });
      continue;
    }

    // Check cooldown
    const lastTrade = state.lastTradeTime[crypto.symbol] ?? 0;
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (now - lastTrade < cooldownMs && lastTrade > 0) {
      const remaining = Math.ceil((cooldownMs - (now - lastTrade)) / 60000);
      logs.push({
        id: uid(),
        timestamp: now,
        type: "scan",
        message: `\u{1F50D} Scan ${crypto.label} \u2014 Cooldown actif (${remaining}min restantes)`,
      });
      continue;
    }

    // Evaluate
    const decision = evaluateEntry(snap.signal, config);

    if (decision.action === "none") {
      logs.push({
        id: uid(),
        timestamp: now,
        type: "scan",
        message: `\u{1F50D} Scan ${crypto.label} \u2014 Score IA: ${decision.score > 0 ? "+" : ""}${decision.score} \u2014 Pas de signal`,
      });
      continue;
    }

    // Open position
    const direction: TradeDirection = decision.action === "open_long" ? "LONG" : "SHORT";
    const portfolioValue = state.portfolioValue + currentPositions.reduce((sum, p) => sum + p.pnl, 0);
    const pos = openPosition(crypto.symbol, direction, snap.price, config, portfolioValue);

    currentPositions.push(pos);

    logs.push({
      id: uid(),
      timestamp: now,
      type: "open",
      message: `\u2705 OPEN ${direction} ${crypto.label} @ $${pos.entryPrice.toFixed(2)} \u2014 Size: $${pos.size.toFixed(0)} \u2014 SL: $${pos.stopLoss.toFixed(2)} \u2014 TP: $${pos.takeProfit.toFixed(2)}`,
    });
  }

  // 4. Calculate portfolio value
  const positionsPnl = currentPositions.reduce((sum, p) => sum + p.pnl, 0);
  const closedPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const capitalInPositions = currentPositions.reduce((sum, p) => sum + p.size, 0);
  const freeCapital = state.portfolioValue - capitalInPositions + closedPnl;
  const portfolioValue = freeCapital + capitalInPositions + positionsPnl;

  // Portfolio summary log
  const totalPnlPct = ((portfolioValue - config.initialCapital) / config.initialCapital) * 100;
  logs.push({
    id: uid(),
    timestamp: now,
    type: "info",
    message: `\u{1F4CA} Portfolio: $${portfolioValue.toFixed(2)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%) \u2014 Positions: ${currentPositions.length} ouverte${currentPositions.length !== 1 ? "s" : ""}`,
  });

  return {
    positions: currentPositions,
    closedTrades,
    logs,
    portfolioValue,
    snapshots,
  };
}
