// ============================================
// Cron Job: /api/bot/run — Runs ONCE daily via Vercel Cron (Hobby plan)
// Simulates 24h of trading retroactively by iterating hourly candles
// Enhanced with 7-component advanced scoring engine
// ============================================

import {
  loadConfigRedis,
  loadStateRedis,
  loadPositionsRedis,
  loadHistoryRedis,
  loadCurveRedis,
  loadLogsRedis,
  saveStateRedis,
  savePositionsRedis,
  saveHistoryRedis,
  saveCurveRedis,
  saveLogsRedis,
} from "@/lib/bot/redis-storage";
import type {
  BotConfig,
  BotState,
  OpenPosition,
  ClosedTrade,
  LogEntry,
  PortfolioPoint,
  TradedCrypto,
  TradeDirection,
} from "@/lib/bot/types";
import { STRATEGIES, TRADED_CRYPTOS } from "@/lib/bot/types";
import { computeAISignal } from "@/lib/indicators/scoring";
import type { OHLCV, AISignalResult } from "@/lib/indicators/types";
import { getOnChainData, type OnChainData } from "@/lib/onchain";
import { getSentimentData, type SentimentData } from "@/lib/sentiment";
import { getLiquidationData, type LiquidationData } from "@/lib/liquidation";
import { getMultiTimeframeData, type MultiTimeframeData } from "@/lib/multi-timeframe";
import { detectRegime, type RegimeAnalysis } from "@/lib/market-regime";
import { evaluateAntiTradeFilters, countConsecutiveLosses } from "@/lib/anti-trade";
import { computeAdvancedScore, type AdvancedSignalResult } from "@/lib/advanced-scoring";
import { computePositionSize, computeDynamicLevels, validateTrade } from "@/lib/risk-management";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---- Helpers ----

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function spread(): number {
  return 0.0005;
}

function slippage(): number {
  return 0.0001 + Math.random() * 0.0009;
}

function applySpreadSlip(price: number, direction: TradeDirection, isEntry: boolean): number {
  const s = spread() + slippage();
  if (direction === "LONG") return isEntry ? price * (1 + s) : price * (1 - s);
  return isEntry ? price * (1 - s) : price * (1 + s);
}

// ---- Enriched data fetched once per cron run ----

interface EnrichedData {
  onChain: OnChainData | null;
  sentiment: SentimentData | null;
  liquidation: Record<string, LiquidationData | null>;
  multiTF: Record<string, MultiTimeframeData | null>;
}

async function fetchEnrichedData(
  enabledCryptos: typeof TRADED_CRYPTOS,
  currentPrices: Record<string, number>,
): Promise<EnrichedData> {
  // Fetch global data (on-chain + sentiment) in parallel with per-crypto data
  const [onChain, sentiment] = await Promise.allSettled([
    getOnChainData(),
    getSentimentData(),
  ]);

  // Fetch per-crypto data in parallel
  const liqPromises = enabledCryptos.map(async (c) => {
    try {
      const price = currentPrices[c.symbol] ?? 0;
      if (price <= 0) return { symbol: c.symbol, data: null };
      return { symbol: c.symbol, data: await getLiquidationData(c.symbol, price) };
    } catch {
      return { symbol: c.symbol, data: null };
    }
  });

  const mtfPromises = enabledCryptos.map(async (c) => {
    try {
      return { symbol: c.symbol, data: await getMultiTimeframeData(c.id) };
    } catch {
      return { symbol: c.symbol, data: null };
    }
  });

  const [liqResults, mtfResults] = await Promise.all([
    Promise.allSettled(liqPromises),
    Promise.allSettled(mtfPromises),
  ]);

  const liquidation: Record<string, LiquidationData | null> = {};
  for (const r of liqResults) {
    if (r.status === "fulfilled") liquidation[r.value.symbol] = r.value.data;
  }

  const multiTF: Record<string, MultiTimeframeData | null> = {};
  for (const r of mtfResults) {
    if (r.status === "fulfilled") multiTF[r.value.symbol] = r.value.data;
  }

  return {
    onChain: onChain.status === "fulfilled" ? onChain.value : null,
    sentiment: sentiment.status === "fulfilled" ? sentiment.value : null,
    liquidation,
    multiTF,
  };
}

// ---- Fetch 24h hourly candles from Binance ----

async function fetchHourlyCandles(symbol: string, hours: number = 24): Promise<OHLCV[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${hours + 100}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const raw: unknown[][] = await res.json();
    return raw.map((k) => ({
      time: Math.floor((k[0] as number) / 1000),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
  } catch {
    return [];
  }
}

// ---- Simulate one hour tick (enhanced) ----

interface HourSimResult {
  positions: OpenPosition[];
  closedTrades: ClosedTrade[];
  logs: LogEntry[];
  portfolioValue: number;
  curvePoints: PortfolioPoint[];
}

function simulateHourTick(
  config: BotConfig,
  state: BotState,
  positions: OpenPosition[],
  historyLen: number,
  allCandles: Record<TradedCrypto, OHLCV[]>,
  hourIndex: number,
  hourTimestamp: number,
  enrichedData: EnrichedData,
  allHistory: ClosedTrade[],
): HourSimResult {
  const logs: LogEntry[] = [];
  const closedTrades: ClosedTrade[] = [];
  const curvePoints: PortfolioPoint[] = [];
  let currentPositions = [...positions];
  let tradeNum = historyLen + 1;
  const strat = STRATEGIES[config.strategy];

  const enabledCryptos = TRADED_CRYPTOS.filter((c) => config.enabledCryptos[c.symbol]);

  // Process each enabled crypto for this hour
  for (const crypto of enabledCryptos) {
    const candles = allCandles[crypto.symbol];
    if (!candles || hourIndex >= candles.length) continue;

    const currentCandle = candles[hourIndex];
    const currentPrice = currentCandle.close;
    const highPrice = currentCandle.high;
    const lowPrice = currentCandle.low;

    // Compute technical signal from candles up to this hour (need at least 30)
    let techSignal: AISignalResult | null = null;
    const sliceEnd = hourIndex + 1;
    const sliceStart = Math.max(0, sliceEnd - 100);
    const candleSlice = candles.slice(sliceStart, sliceEnd);
    if (candleSlice.length >= 30) {
      try {
        techSignal = computeAISignal(candleSlice);
      } catch {
        // Skip if computation fails
      }
    }

    // Detect market regime from candles
    let regimeAnalysis: RegimeAnalysis | null = null;
    if (candleSlice.length >= 30) {
      try {
        regimeAnalysis = detectRegime(candleSlice);
      } catch {
        // Non-critical
      }
    }

    // Compute advanced score (7-component)
    let advancedSignal: AdvancedSignalResult | null = null;
    if (techSignal) {
      try {
        // Compute 7d price change for sentiment divergence
        const priceChange7d = candleSlice.length >= 168
          ? ((currentPrice - candleSlice[candleSlice.length - 168].close) / candleSlice[candleSlice.length - 168].close) * 100
          : undefined;

        advancedSignal = computeAdvancedScore({
          technicalSignal: techSignal,
          onChainData: enrichedData.onChain,
          sentimentData: enrichedData.sentiment,
          liquidationData: enrichedData.liquidation[crypto.symbol] ?? null,
          multiTFData: enrichedData.multiTF[crypto.symbol] ?? null,
          regimeAnalysis,
          currentPrice,
          priceChange7d,
        });
      } catch {
        // Fallback: use tech signal only
      }
    }

    // Use advanced score if available, otherwise fall back to technical
    const effectiveScore = advancedSignal?.globalScore ?? techSignal?.globalScore ?? 0;
    const effectiveConfidence = advancedSignal?.confidence ?? techSignal?.confidence ?? 0;

    // ---- Tick existing positions for this crypto ----
    const cryptoPositions = currentPositions.filter((p) => p.crypto === crypto.symbol);
    for (const pos of cryptoPositions) {
      // Check if SL was hit during this candle (using high/low)
      const slPrice = pos.trailingStopPrice ?? pos.stopLoss;
      const hitSL = pos.direction === "LONG" ? lowPrice <= slPrice : highPrice >= slPrice;

      if (hitSL) {
        const exitPrice = applySpreadSlip(slPrice, pos.direction, false);
        const diff = pos.direction === "LONG"
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnl = pos.size * diff;
        closedTrades.push({
          id: pos.id,
          tradeNumber: tradeNum++,
          crypto: pos.crypto,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: hourTimestamp,
          size: pos.size,
          pnl,
          pnlPct: diff * 100,
          result: pnl >= 0 ? "win" : "loss",
          closeReason: pos.trailingStopPrice ? "trailing_stop" : "stop_loss",
        });
        currentPositions = currentPositions.filter((p) => p.id !== pos.id);
        logs.push({
          id: uid(), timestamp: hourTimestamp, type: "close" as const,
          message: `🛑 CLOSE ${pos.direction} ${crypto.label} @ $${slPrice.toFixed(2)} — P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} — ${pos.trailingStopPrice ? "Trailing stop" : "Stop loss"}`,
        });
        continue;
      }

      // Check if TP was hit
      const hitTP = pos.direction === "LONG" ? highPrice >= pos.takeProfit : lowPrice <= pos.takeProfit;
      if (hitTP) {
        const exitPrice = applySpreadSlip(pos.takeProfit, pos.direction, false);
        const diff = pos.direction === "LONG"
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnl = pos.size * diff;
        closedTrades.push({
          id: pos.id,
          tradeNumber: tradeNum++,
          crypto: pos.crypto,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: hourTimestamp,
          size: pos.size,
          pnl,
          pnlPct: diff * 100,
          result: "win",
          closeReason: "take_profit",
        });
        currentPositions = currentPositions.filter((p) => p.id !== pos.id);
        logs.push({
          id: uid(), timestamp: hourTimestamp, type: "close" as const,
          message: `💰 CLOSE ${pos.direction} ${crypto.label} @ $${pos.takeProfit.toFixed(2)} — P&L: +$${pnl.toFixed(2)} — Take Profit!`,
        });
        continue;
      }

      // Check signal reversal (using advanced score)
      const reversed = (pos.direction === "LONG" && effectiveScore < -30)
        || (pos.direction === "SHORT" && effectiveScore > 30);
      if (reversed) {
        const exitPrice = applySpreadSlip(currentPrice, pos.direction, false);
        const diff = pos.direction === "LONG"
          ? (exitPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - exitPrice) / pos.entryPrice;
        const pnl = pos.size * diff;
        closedTrades.push({
          id: pos.id,
          tradeNumber: tradeNum++,
          crypto: pos.crypto,
          direction: pos.direction,
          entryPrice: pos.entryPrice,
          exitPrice,
          entryTime: pos.entryTime,
          exitTime: hourTimestamp,
          size: pos.size,
          pnl,
          pnlPct: diff * 100,
          result: pnl >= 0 ? "win" : "loss",
          closeReason: "signal_reversed",
        });
        currentPositions = currentPositions.filter((p) => p.id !== pos.id);
        logs.push({
          id: uid(), timestamp: hourTimestamp, type: "close" as const,
          message: `🔄 CLOSE ${pos.direction} ${crypto.label} @ $${currentPrice.toFixed(2)} — P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} — Signal inversé (score: ${effectiveScore})`,
        });
        continue;
      }

      // Update trailing stop
      const idx = currentPositions.findIndex((p) => p.id === pos.id);
      if (idx !== -1) {
        let ts = pos.trailingStopPrice;
        if (config.trailingStop && ts !== null) {
          if (pos.direction === "LONG" && highPrice > pos.entryPrice) {
            const newTS = highPrice * (1 - strat.stopLossPct / 100);
            if (newTS > ts) ts = newTS;
          } else if (pos.direction === "SHORT" && lowPrice < pos.entryPrice) {
            const newTS = lowPrice * (1 + strat.stopLossPct / 100);
            if (newTS < ts) ts = newTS;
          }
        }
        const { pnl, pnlPct } = computePnlSimple(pos, currentPrice);
        currentPositions[idx] = { ...pos, currentPrice, pnl, pnlPct, trailingStopPrice: ts };
      }
    }

    // ---- Evaluate new entries (enhanced with advanced engine) ----
    if (!techSignal) continue;
    const hasPosition = currentPositions.some((p) => p.crypto === crypto.symbol);
    if (hasPosition) continue;
    if (currentPositions.length >= config.maxConcurrentTrades) continue;

    // Check cooldown
    const lastTrade = state.lastTradeTime[crypto.symbol] ?? 0;
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (hourTimestamp - lastTrade < cooldownMs && lastTrade > 0) continue;

    // Use advanced score threshold with regime adjustment
    const absScore = Math.abs(effectiveScore);
    if (absScore < strat.scoreThreshold) continue;

    // Determine direction from advanced signal or fallback to technical
    let direction: TradeDirection | null = advancedSignal?.recommendedDirection ?? null;

    if (!direction) {
      // Fallback: original logic
      const score = techSignal.globalScore;
      const momentum = techSignal.categories.find((c) => c.category === "Momentum");
      const trend = techSignal.categories.find((c) => c.category === "Tendance" || c.category === "Trend");
      const volume = techSignal.categories.find((c) => c.category === "Volume");
      const rsiScore = momentum?.indicators.find((i) => i.name === "RSI")?.score ?? 0;
      const macdScore = trend?.indicators.find((i) => i.name === "MACD")?.score ?? 0;
      const smaScore = trend?.indicators.find((i) => i.name.includes("SMA") || i.name.includes("EMA"))?.score ?? 0;
      const volumeScore = volume?.indicators.find((i) => i.name.includes("Volume") || i.name.includes("OBV"))?.score ?? 0;

      if (score > strat.scoreThreshold) {
        const conditions = [true, rsiScore > -50, macdScore > -10, smaScore > -20, volumeScore > -20];
        if (conditions.filter(Boolean).length >= 3) direction = "LONG";
      } else if (score < -strat.scoreThreshold) {
        const conditions = [true, rsiScore < 50, macdScore < 10, smaScore < 20, volumeScore > -20];
        if (conditions.filter(Boolean).length >= 3) direction = "SHORT";
      }
    }

    if (!direction) continue;

    // ---- Anti-trade filters ----
    const combinedHistory = [...allHistory, ...closedTrades];
    const consecutiveLosses = countConsecutiveLosses(combinedHistory);
    const hourUTC = new Date(hourTimestamp).getUTCHours();

    const antiTradeResult = evaluateAntiTradeFilters(
      {
        recentTrades: combinedHistory.slice(-10),
        currentHourUTC: hourUTC,
        regime: regimeAnalysis?.regime ?? "ranging",
        sentiment: enrichedData.sentiment,
        consecutiveLosses,
        currentDrawdownPct: state.currentDrawdown,
        maxDrawdownPct: config.maxDrawdownPct,
      },
      direction,
    );

    if (!antiTradeResult.shouldTrade) {
      logs.push({
        id: uid(), timestamp: hourTimestamp, type: "info" as const,
        message: `🚫 BLOCKED ${direction} ${crypto.label} — ${antiTradeResult.reasons.join(", ")}`,
      });
      continue;
    }

    // ---- Position sizing (Kelly criterion) ----
    const positionSizing = computePositionSize(
      config, state, combinedHistory,
      regimeAnalysis, effectiveConfidence,
    );
    const allocation = config.allocations[crypto.symbol] / 100;
    const size = Math.min(
      positionSizing.size * allocation * (100 / Math.max(config.allocations[crypto.symbol], 1)),
      state.portfolioValue * (strat.positionSizePct / 100),
    );

    const entryPrice = applySpreadSlip(currentPrice, direction, true);

    // ---- Dynamic SL/TP ----
    const atrValue = techSignal.stopLoss
      ? Math.abs(techSignal.entryPrice - techSignal.stopLoss) / 2
      : currentPrice * 0.02;

    const dynamicLevels = computeDynamicLevels(
      entryPrice, direction, atrValue,
      config, regimeAnalysis, effectiveConfidence,
    );

    // Validate minimum risk/reward
    const rrCheck = validateTrade(entryPrice, dynamicLevels.stopLoss, dynamicLevels.takeProfit1);
    if (!rrCheck.valid) {
      logs.push({
        id: uid(), timestamp: hourTimestamp, type: "info" as const,
        message: `⚠️ SKIP ${direction} ${crypto.label} — ${rrCheck.reason}`,
      });
      continue;
    }

    const newPos: OpenPosition = {
      id: uid(),
      crypto: crypto.symbol,
      direction,
      entryPrice,
      entryTime: hourTimestamp,
      size,
      stopLoss: dynamicLevels.stopLoss,
      takeProfit: dynamicLevels.takeProfit1,
      trailingStopPrice: config.trailingStop ? dynamicLevels.stopLoss : null,
      currentPrice,
      pnl: 0,
      pnlPct: 0,
    };
    currentPositions.push(newPos);
    state.lastTradeTime[crypto.symbol] = hourTimestamp;

    // Enriched log with reasoning
    const regimeStr = regimeAnalysis ? ` | Regime: ${regimeAnalysis.regime}` : "";
    const reasoningStr = advancedSignal?.reasoning ?? "";
    logs.push({
      id: uid(), timestamp: hourTimestamp, type: "open" as const,
      message: `✅ OPEN ${direction} ${crypto.label} @ $${entryPrice.toFixed(2)} — Size: $${size.toFixed(0)} (Kelly: ${(positionSizing.kellyFraction * 100).toFixed(1)}%) — SL: $${dynamicLevels.stopLoss.toFixed(2)} — TP: $${dynamicLevels.takeProfit1.toFixed(2)} (R:R ${rrCheck.rr.toFixed(1)}:1)${regimeStr}`,
    });
    if (reasoningStr) {
      logs.push({
        id: uid(), timestamp: hourTimestamp, type: "info" as const,
        message: `🧠 ${crypto.label}: ${reasoningStr}`,
      });
    }
  }

  // Calculate portfolio value
  const positionsPnl = currentPositions.reduce((sum, p) => sum + p.pnl, 0);
  const closedPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const capitalInPositions = currentPositions.reduce((sum, p) => sum + p.size, 0);
  const freeCapital = state.portfolioValue - capitalInPositions + closedPnl;
  const portfolioValue = freeCapital + capitalInPositions + positionsPnl;

  curvePoints.push({ t: hourTimestamp, v: portfolioValue });

  return { positions: currentPositions, closedTrades, logs, portfolioValue, curvePoints };
}

function computePnlSimple(pos: OpenPosition, currentPrice: number): { pnl: number; pnlPct: number } {
  const exitPrice = applySpreadSlip(currentPrice, pos.direction, false);
  const diff = pos.direction === "LONG"
    ? (exitPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - exitPrice) / pos.entryPrice;
  return { pnl: pos.size * diff, pnlPct: diff * 100 };
}

// ---- Main Route Handler ----

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await loadStateRedis();

    if (!state.running) {
      return Response.json({ status: "skipped", reason: "Bot not running" });
    }

    const config = await loadConfigRedis();
    const positions = await loadPositionsRedis();
    const history = await loadHistoryRedis();
    const curve = await loadCurveRedis();
    const logs = await loadLogsRedis();

    // ---- Fetch 24h hourly candles for all enabled cryptos ----
    const enabledCryptos = TRADED_CRYPTOS.filter((c) => config.enabledCryptos[c.symbol]);
    const candleResults = await Promise.all(
      enabledCryptos.map(async (c) => {
        const candles = await fetchHourlyCandles(c.symbol, 24);
        return { symbol: c.symbol, candles };
      }),
    );

    const allCandles: Record<string, OHLCV[]> = {};
    for (const r of candleResults) {
      allCandles[r.symbol] = r.candles;
    }

    // Determine how many hours to simulate (last 24 from candle data)
    const maxCandles = Math.max(...Object.values(allCandles).map((c) => c.length), 0);
    if (maxCandles === 0) {
      return Response.json({ status: "error", error: "No candle data available" }, { status: 500 });
    }

    // Get current prices for enriched data fetching
    const currentPrices: Record<string, number> = {};
    for (const c of enabledCryptos) {
      const candles = allCandles[c.symbol];
      if (candles && candles.length > 0) {
        currentPrices[c.symbol] = candles[candles.length - 1].close;
      }
    }

    // ---- Fetch enriched data (on-chain, sentiment, liquidation, multi-TF) ----
    // This runs once per cron, not per hour — cached in Redis (5min TTL)
    let enrichedData: EnrichedData;
    try {
      enrichedData = await fetchEnrichedData(enabledCryptos, currentPrices);
    } catch {
      enrichedData = { onChain: null, sentiment: null, liquidation: {}, multiTF: {} };
    }

    // Start simulation from 24h ago (or whatever data we have)
    const startIndex = Math.max(0, maxCandles - 24);
    const simState = { ...state };
    let simPositions = [...positions];
    const allClosedTrades: ClosedTrade[] = [];
    const allLogs: LogEntry[] = [];
    const allCurvePoints: PortfolioPoint[] = [];

    // Add start log with enriched data status
    const dataStatus = [
      enrichedData.onChain ? "on-chain" : null,
      enrichedData.sentiment ? "sentiment" : null,
      Object.values(enrichedData.liquidation).some(Boolean) ? "liquidation" : null,
      Object.values(enrichedData.multiTF).some(Boolean) ? "multi-TF" : null,
    ].filter(Boolean).join(", ");

    allLogs.push({
      id: uid(),
      timestamp: Date.now(),
      type: "info" as const,
      message: `🤖 Batch journalier — Simulation de ${maxCandles - startIndex}h — Engine v2 (7 composants)${dataStatus ? ` — Data: ${dataStatus}` : ""}`,
    });

    // Iterate hour by hour
    for (let i = startIndex; i < maxCandles; i++) {
      // Get timestamp from any available candle at this index
      let hourTimestamp = Date.now();
      for (const c of enabledCryptos) {
        const candles = allCandles[c.symbol];
        if (candles && i < candles.length) {
          hourTimestamp = candles[i].time * 1000; // Convert to ms
          break;
        }
      }

      const result = simulateHourTick(
        config,
        simState,
        simPositions,
        history.length + allClosedTrades.length,
        allCandles as Record<TradedCrypto, OHLCV[]>,
        i,
        hourTimestamp,
        enrichedData,
        [...history, ...allClosedTrades],
      );

      simPositions = result.positions;
      allClosedTrades.push(...result.closedTrades);
      allLogs.push(...result.logs);
      allCurvePoints.push(...result.curvePoints);

      // Update state for next iteration
      simState.portfolioValue = result.portfolioValue;
      if (result.portfolioValue > simState.peakValue) {
        simState.peakValue = result.portfolioValue;
      }
      simState.currentDrawdown = simState.peakValue > 0
        ? ((simState.peakValue - result.portfolioValue) / simState.peakValue) * 100
        : 0;

      // Check max drawdown auto-stop
      if (simState.currentDrawdown >= config.maxDrawdownPct) {
        simState.running = false;
        allLogs.push({
          id: uid(),
          timestamp: hourTimestamp,
          type: "warning" as const,
          message: `⛔ MAX DRAWDOWN ATTEINT (${simState.currentDrawdown.toFixed(1)}%) — Bot arrêté automatiquement`,
        });
        break;
      }
    }

    // Update today stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayPnl = allClosedTrades
      .filter((t) => t.exitTime >= todayStart.getTime())
      .reduce((sum, t) => sum + t.pnl, 0);
    simState.todayPnl = todayPnl;
    simState.todayTradeCount = allClosedTrades.length;

    // Update last trade times
    for (const trade of allClosedTrades) {
      simState.lastTradeTime[trade.crypto] = trade.exitTime;
    }

    // Summary log
    const totalPnlPct = ((simState.portfolioValue - config.initialCapital) / config.initialCapital) * 100;
    const winCount = allClosedTrades.filter((t) => t.result === "win").length;
    const lossCount = allClosedTrades.filter((t) => t.result === "loss").length;
    const winRate = allClosedTrades.length > 0 ? ((winCount / allClosedTrades.length) * 100).toFixed(0) : "N/A";
    allLogs.push({
      id: uid(),
      timestamp: Date.now(),
      type: "info" as const,
      message: `📊 Résumé journalier — Portfolio: $${simState.portfolioValue.toFixed(2)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%) — ${allClosedTrades.length} trades — ${winCount}W/${lossCount}L (${winRate}% WR)`,
    });

    // Save everything to Redis
    const newHistory = [...history, ...allClosedTrades];
    const newCurve = [...curve, ...allCurvePoints];
    const newLogs = [...logs, ...allLogs];

    await Promise.all([
      saveStateRedis(simState),
      savePositionsRedis(simPositions),
      saveHistoryRedis(newHistory),
      saveCurveRedis(newCurve),
      saveLogsRedis(newLogs),
    ]);

    return Response.json({
      status: "ok",
      engine: "v2-advanced",
      hoursSimulated: maxCandles - Math.max(0, maxCandles - 24),
      portfolioValue: simState.portfolioValue,
      openPositions: simPositions.length,
      closedTrades: allClosedTrades.length,
      wins: winCount,
      losses: lossCount,
      winRate,
      drawdown: simState.currentDrawdown.toFixed(2),
      running: simState.running,
      enrichedData: {
        onChain: !!enrichedData.onChain,
        sentiment: !!enrichedData.sentiment,
        liquidation: Object.keys(enrichedData.liquidation).length,
        multiTF: Object.keys(enrichedData.multiTF).length,
      },
    });
  } catch (err) {
    console.error("Bot daily cron error:", err);
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
