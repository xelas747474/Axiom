// ============================================
// Cron Job: /api/bot/run — Runs every 2 minutes via Vercel Cron (Pro plan)
// Real-time trading: checks current prices, manages positions, evaluates signals
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
import { getCurrentPrices } from "@/lib/market-data";
import { getOnChainData, type OnChainData } from "@/lib/onchain";
import { getSentimentData, type SentimentData } from "@/lib/sentiment";
import { getLiquidationData, type LiquidationData } from "@/lib/liquidation";
import { getMultiTimeframeData, type MultiTimeframeData } from "@/lib/multi-timeframe";
import { detectRegime, type RegimeAnalysis } from "@/lib/market-regime";
import { evaluateAntiTradeFilters, countConsecutiveLosses } from "@/lib/anti-trade";
import { computeAdvancedScore, type AdvancedSignalResult } from "@/lib/advanced-scoring";
import { computePositionSize, computeDynamicLevels, validateTrade } from "@/lib/risk-management";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro: 60s (plenty for real-time tick)

const MIN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between trades on same crypto
const MAX_LOGS = 500;

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

// ---- Fetch hourly candles from Binance (for technical scoring) ----

const BINANCE_ENDPOINTS = [
  "https://api.binance.com/api/v3",
  "https://api1.binance.com/api/v3",
  "https://api2.binance.com/api/v3",
  "https://api3.binance.com/api/v3",
  "https://api.binance.us/api/v3",
];

async function fetchHourlyCandles(symbol: string, hours: number = 120): Promise<OHLCV[]> {
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const url = `${base}/klines?symbol=${symbol}&interval=1h&limit=${hours}`;
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
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
      continue;
    }
  }
  return [];
}

// ---- Enriched data (cached in Redis 5min, shared across runs) ----

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
  const [onChain, sentiment] = await Promise.allSettled([
    getOnChainData(),
    getSentimentData(),
  ]);

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

function computePnlSimple(pos: OpenPosition, currentPrice: number): { pnl: number; pnlPct: number } {
  const exitPrice = applySpreadSlip(currentPrice, pos.direction, false);
  const diff = pos.direction === "LONG"
    ? (exitPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - exitPrice) / pos.entryPrice;
  return { pnl: pos.size * diff, pnlPct: diff * 100 };
}

// ---- Main Route Handler (every 2 minutes) ----

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
    let positions = await loadPositionsRedis();
    const history = await loadHistoryRedis();
    const curve = await loadCurveRedis();
    const existingLogs = await loadLogsRedis();

    const now = Date.now();
    const strat = STRATEGIES[config.strategy];
    const enabledCryptos = TRADED_CRYPTOS.filter((c) => config.enabledCryptos[c.symbol]);

    // ---- Fetch current prices from Binance (single call) ----
    const allPrices = await getCurrentPrices();
    const currentPrices: Record<string, number> = {};
    for (const c of enabledCryptos) {
      // Map BTCUSDT → BTC for market-data lookup
      const sym = c.symbol.replace("USDT", "");
      if (allPrices[sym]) {
        currentPrices[c.symbol] = allPrices[sym].price;
      }
    }

    if (Object.keys(currentPrices).length === 0) {
      return Response.json({ status: "error", error: "No price data available" }, { status: 500 });
    }

    // ---- Fetch candles for technical analysis (in parallel) ----
    const candleResults = await Promise.all(
      enabledCryptos.map(async (c) => {
        const candles = await fetchHourlyCandles(c.symbol, 120);
        return { symbol: c.symbol, candles };
      }),
    );

    const allCandles: Record<string, OHLCV[]> = {};
    for (const r of candleResults) {
      allCandles[r.symbol] = r.candles;
    }

    // ---- Fetch enriched data (cached 5min in Redis) ----
    let enrichedData: EnrichedData;
    try {
      enrichedData = await fetchEnrichedData(enabledCryptos, currentPrices);
    } catch {
      enrichedData = { onChain: null, sentiment: null, liquidation: {}, multiTF: {} };
    }

    const newLogs: LogEntry[] = [];
    const closedTrades: ClosedTrade[] = [];
    const curvePoints: PortfolioPoint[] = [];
    let tradeNum = history.length + 1;

    // ---- Process each enabled crypto ----
    for (const crypto of enabledCryptos) {
      const currentPrice = currentPrices[crypto.symbol];
      if (!currentPrice || currentPrice <= 0) continue;

      const candles = allCandles[crypto.symbol];
      const label = crypto.label;

      // ---- 1. Check existing positions (SL/TP/trailing/reversal) ----
      const cryptoPositions = positions.filter((p) => p.crypto === crypto.symbol);
      for (const pos of cryptoPositions) {
        const slPrice = pos.trailingStopPrice ?? pos.stopLoss;

        // Stop loss check
        const hitSL = pos.direction === "LONG" ? currentPrice <= slPrice : currentPrice >= slPrice;
        if (hitSL) {
          const exitPrice = applySpreadSlip(slPrice, pos.direction, false);
          const diff = pos.direction === "LONG"
            ? (exitPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - exitPrice) / pos.entryPrice;
          const pnl = pos.size * diff;
          closedTrades.push({
            id: pos.id, tradeNumber: tradeNum++, crypto: pos.crypto, direction: pos.direction,
            entryPrice: pos.entryPrice, exitPrice, entryTime: pos.entryTime, exitTime: now,
            size: pos.size, pnl, pnlPct: diff * 100,
            result: pnl >= 0 ? "win" : "loss",
            closeReason: pos.trailingStopPrice ? "trailing_stop" : "stop_loss",
          });
          positions = positions.filter((p) => p.id !== pos.id);
          newLogs.push({
            id: uid(), timestamp: now, type: "close",
            message: `🛑 CLOSE ${pos.direction} ${label} @ $${exitPrice.toFixed(2)} — P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} — ${pos.trailingStopPrice ? "Trailing Stop" : "Stop Loss"}`,
          });
          continue;
        }

        // Take profit check
        const hitTP = pos.direction === "LONG" ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit;
        if (hitTP) {
          const exitPrice = applySpreadSlip(pos.takeProfit, pos.direction, false);
          const diff = pos.direction === "LONG"
            ? (exitPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - exitPrice) / pos.entryPrice;
          const pnl = pos.size * diff;
          closedTrades.push({
            id: pos.id, tradeNumber: tradeNum++, crypto: pos.crypto, direction: pos.direction,
            entryPrice: pos.entryPrice, exitPrice, entryTime: pos.entryTime, exitTime: now,
            size: pos.size, pnl, pnlPct: diff * 100, result: "win", closeReason: "take_profit",
          });
          positions = positions.filter((p) => p.id !== pos.id);
          newLogs.push({
            id: uid(), timestamp: now, type: "close",
            message: `💰 CLOSE ${pos.direction} ${label} @ $${exitPrice.toFixed(2)} — P&L: +$${pnl.toFixed(2)} — Take Profit!`,
          });
          continue;
        }

        // Update trailing stop
        const idx = positions.findIndex((p) => p.id === pos.id);
        if (idx !== -1) {
          let ts = pos.trailingStopPrice;
          if (config.trailingStop && ts !== null) {
            if (pos.direction === "LONG" && currentPrice > pos.entryPrice) {
              const newTS = currentPrice * (1 - strat.stopLossPct / 100);
              if (newTS > ts) {
                newLogs.push({
                  id: uid(), timestamp: now, type: "info",
                  message: `📈 ${label} ${pos.direction} — Trailing stop: $${ts.toFixed(2)} → $${newTS.toFixed(2)}`,
                });
                ts = newTS;
              }
            } else if (pos.direction === "SHORT" && currentPrice < pos.entryPrice) {
              const newTS = currentPrice * (1 + strat.stopLossPct / 100);
              if (newTS < ts) {
                newLogs.push({
                  id: uid(), timestamp: now, type: "info",
                  message: `📉 ${label} ${pos.direction} — Trailing stop: $${ts.toFixed(2)} → $${newTS.toFixed(2)}`,
                });
                ts = newTS;
              }
            }
          }
          const { pnl, pnlPct } = computePnlSimple(pos, currentPrice);
          positions[idx] = { ...pos, currentPrice, pnl, pnlPct, trailingStopPrice: ts };
        }
      }

      // ---- 2. Evaluate new entries ----
      // Skip if already have a position on this crypto
      if (positions.some((p) => p.crypto === crypto.symbol)) continue;
      if (positions.length >= config.maxConcurrentTrades) continue;

      // 30-minute cooldown per crypto
      const lastTrade = state.lastTradeTime[crypto.symbol] ?? 0;
      if (now - lastTrade < MIN_COOLDOWN_MS && lastTrade > 0) continue;

      // Need candles for technical analysis
      if (!candles || candles.length < 30) continue;

      // Compute technical signal
      let techSignal: AISignalResult | null = null;
      try {
        techSignal = computeAISignal(candles);
      } catch { continue; }

      // Compute regime
      let regimeAnalysis: RegimeAnalysis | null = null;
      try { regimeAnalysis = detectRegime(candles); } catch { /* non-critical */ }

      // Compute advanced 7-component score
      let advancedSignal: AdvancedSignalResult | null = null;
      if (techSignal) {
        try {
          const priceChange7d = candles.length >= 168
            ? ((currentPrice - candles[candles.length - 168].close) / candles[candles.length - 168].close) * 100
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
        } catch { /* fallback to tech signal */ }
      }

      const effectiveScore = advancedSignal?.globalScore ?? techSignal?.globalScore ?? 0;
      const effectiveConfidence = advancedSignal?.confidence ?? techSignal?.confidence ?? 0;
      const absScore = Math.abs(effectiveScore);

      if (absScore < strat.scoreThreshold) continue;

      // Determine direction
      let direction: TradeDirection | null = advancedSignal?.recommendedDirection ?? null;
      if (!direction) {
        if (effectiveScore > strat.scoreThreshold) direction = "LONG";
        else if (effectiveScore < -strat.scoreThreshold) direction = "SHORT";
      }
      if (!direction) continue;

      // Anti-trade filters
      const combinedHistory = [...history, ...closedTrades];
      const consecutiveLosses = countConsecutiveLosses(combinedHistory);
      const hourUTC = new Date(now).getUTCHours();

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
        newLogs.push({
          id: uid(), timestamp: now, type: "info",
          message: `🚫 BLOCKED ${direction} ${label} — ${antiTradeResult.reasons.join(", ")}`,
        });
        continue;
      }

      // Position sizing (Kelly)
      const positionSizing = computePositionSize(
        config, state, combinedHistory, regimeAnalysis, effectiveConfidence,
      );
      const allocation = config.allocations[crypto.symbol] / 100;
      const size = Math.min(
        positionSizing.size * allocation * (100 / Math.max(config.allocations[crypto.symbol], 1)),
        state.portfolioValue * (strat.positionSizePct / 100),
      );

      const entryPrice = applySpreadSlip(currentPrice, direction, true);

      // Dynamic SL/TP
      const atrValue = techSignal?.stopLoss
        ? Math.abs(techSignal.entryPrice - techSignal.stopLoss) / 2
        : currentPrice * 0.02;

      const dynamicLevels = computeDynamicLevels(
        entryPrice, direction, atrValue, config, regimeAnalysis, effectiveConfidence,
      );

      const rrCheck = validateTrade(entryPrice, dynamicLevels.stopLoss, dynamicLevels.takeProfit1);
      if (!rrCheck.valid) {
        newLogs.push({
          id: uid(), timestamp: now, type: "info",
          message: `⚠️ SKIP ${direction} ${label} — ${rrCheck.reason}`,
        });
        continue;
      }

      const newPos: OpenPosition = {
        id: uid(), crypto: crypto.symbol, direction, entryPrice, entryTime: now,
        size, stopLoss: dynamicLevels.stopLoss, takeProfit: dynamicLevels.takeProfit1,
        trailingStopPrice: config.trailingStop ? dynamicLevels.stopLoss : null,
        currentPrice, pnl: 0, pnlPct: 0,
      };
      positions.push(newPos);
      state.lastTradeTime[crypto.symbol] = now;

      const regimeStr = regimeAnalysis ? ` | Régime: ${regimeAnalysis.regime}` : "";
      const reasoning = advancedSignal?.reasoning ?? "";
      newLogs.push({
        id: uid(), timestamp: now, type: "open",
        message: `✅ OPEN ${direction} ${label} @ $${entryPrice.toFixed(2)} — Size: $${size.toFixed(0)} — SL: $${dynamicLevels.stopLoss.toFixed(2)} — TP: $${dynamicLevels.takeProfit1.toFixed(2)} (R:R ${rrCheck.rr.toFixed(1)}:1)${regimeStr}`,
      });
      if (reasoning) {
        newLogs.push({
          id: uid(), timestamp: now, type: "info",
          message: `🧠 ${label}: ${reasoning}`,
        });
      }
    }

    // ---- Update portfolio value ----
    const positionsPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const closedPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const capitalInPositions = positions.reduce((sum, p) => sum + p.size, 0);
    const freeCapital = state.portfolioValue - capitalInPositions + closedPnl;
    state.portfolioValue = freeCapital + capitalInPositions + positionsPnl;

    if (state.portfolioValue > state.peakValue) {
      state.peakValue = state.portfolioValue;
    }
    state.currentDrawdown = state.peakValue > 0
      ? ((state.peakValue - state.portfolioValue) / state.peakValue) * 100
      : 0;

    // Add curve point
    curvePoints.push({ t: now, v: state.portfolioValue });

    // Max drawdown auto-stop
    if (state.currentDrawdown >= config.maxDrawdownPct) {
      state.running = false;
      newLogs.push({
        id: uid(), timestamp: now, type: "warning",
        message: `⛔ MAX DRAWDOWN (${state.currentDrawdown.toFixed(1)}%) — Bot arrêté`,
      });
    }

    // Today stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    state.todayPnl = [...history, ...closedTrades]
      .filter((t) => t.exitTime >= todayStart.getTime())
      .reduce((sum, t) => sum + t.pnl, 0);
    state.todayTradeCount = [...history, ...closedTrades]
      .filter((t) => t.exitTime >= todayStart.getTime()).length;

    for (const trade of closedTrades) {
      state.lastTradeTime[trade.crypto] = trade.exitTime;
    }

    // ---- Save to Redis ----
    const newHistory = [...history, ...closedTrades];
    const newCurve = [...curve, ...curvePoints];
    // Trim logs to MAX_LOGS
    const allLogs = [...existingLogs, ...newLogs].slice(-MAX_LOGS);

    await Promise.all([
      saveStateRedis(state),
      savePositionsRedis(positions),
      saveHistoryRedis(newHistory),
      saveCurveRedis(newCurve),
      saveLogsRedis(allLogs),
    ]);

    return Response.json({
      status: "ok",
      engine: "v3-realtime",
      portfolioValue: state.portfolioValue,
      openPositions: positions.length,
      closedTrades: closedTrades.length,
      newLogs: newLogs.length,
      drawdown: state.currentDrawdown.toFixed(2),
      running: state.running,
    });
  } catch (err) {
    console.error("Bot cron error:", err);
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
