// ============================================
// Cron Job: /api/bot/run — Runs every 2 minutes via Vercel Cron (Pro plan)
// Real-time trading with SIMPLIFIED decision logic
// Entry = technical score (RSI + SMA + momentum + 24h change) vs strategy threshold
// Anti-trade filters temporarily DISABLED — can be re-enabled later
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
  OpenPosition,
  ClosedTrade,
  LogEntry,
  PortfolioPoint,
  TradeDirection,
} from "@/lib/bot/types";
import { STRATEGIES, TRADED_CRYPTOS } from "@/lib/bot/types";
import { computeAISignal } from "@/lib/indicators/scoring";
import type { OHLCV, AISignalResult } from "@/lib/indicators/types";
import { getCurrentPrices } from "@/lib/market-data";
// --- Temporarily disabled advanced modules (kept for future re-enable) ---
// import { getOnChainData } from "@/lib/onchain";
// import { getSentimentData } from "@/lib/sentiment";
// import { getLiquidationData } from "@/lib/liquidation";
// import { getMultiTimeframeData } from "@/lib/multi-timeframe";
// import { detectRegime } from "@/lib/market-regime";
// import { evaluateAntiTradeFilters, countConsecutiveLosses } from "@/lib/anti-trade";
// import { computeAdvancedScore } from "@/lib/advanced-scoring";
// import { computePositionSize, computeDynamicLevels, validateTrade } from "@/lib/risk-management";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between trades on same crypto
const MAX_LOGS = 500;

// ---- Helpers ----

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function applySpreadSlip(price: number, direction: TradeDirection, isEntry: boolean): number {
  const s = 0.0005 + 0.0001 + Math.random() * 0.0009;
  if (direction === "LONG") return isEntry ? price * (1 + s) : price * (1 - s);
  return isEntry ? price * (1 - s) : price * (1 + s);
}

// ---- Fetch hourly candles from Binance (multi-endpoint fallback) ----

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

function computePnlSimple(pos: OpenPosition, currentPrice: number): { pnl: number; pnlPct: number } {
  const exitPrice = applySpreadSlip(currentPrice, pos.direction, false);
  const diff = pos.direction === "LONG"
    ? (exitPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - exitPrice) / pos.entryPrice;
  return { pnl: pos.size * diff, pnlPct: diff * 100 };
}

// ---- Main Route Handler (every 2 minutes) ----

export async function GET(request: Request) {
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

    // ---- Fetch current prices (single Binance call) ----
    const allPrices = await getCurrentPrices();
    const currentPrices: Record<string, number> = {};
    for (const c of enabledCryptos) {
      const sym = c.symbol.replace("USDT", "");
      if (allPrices[sym]) currentPrices[c.symbol] = allPrices[sym].price;
    }

    if (Object.keys(currentPrices).length === 0) {
      return Response.json({ status: "error", error: "No price data available" }, { status: 500 });
    }

    // ---- Fetch candles for technical scoring (in parallel) ----
    const candleResults = await Promise.all(
      enabledCryptos.map(async (c) => ({
        symbol: c.symbol,
        candles: await fetchHourlyCandles(c.symbol, 120),
      })),
    );
    const allCandles: Record<string, OHLCV[]> = {};
    for (const r of candleResults) allCandles[r.symbol] = r.candles;

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

      // ---- 1. Manage existing positions (SL/TP/trailing) ----
      const cryptoPositions = positions.filter((p) => p.crypto === crypto.symbol);
      for (const pos of cryptoPositions) {
        const slPrice = pos.trailingStopPrice ?? pos.stopLoss;

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

        // Trailing stop update
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

      // ---- 2. Evaluate new entry (SIMPLIFIED logic) ----
      if (positions.some((p) => p.crypto === crypto.symbol)) continue;
      if (positions.length >= config.maxConcurrentTrades) continue;

      // 30-min cooldown per crypto
      const lastTrade = state.lastTradeTime[crypto.symbol] ?? 0;
      if (now - lastTrade < MIN_COOLDOWN_MS && lastTrade > 0) {
        newLogs.push({
          id: uid(), timestamp: now, type: "scan",
          message: `⏳ SCAN ${label} — Cooldown actif (${Math.round((MIN_COOLDOWN_MS - (now - lastTrade)) / 60000)} min restantes)`,
        });
        continue;
      }

      if (!candles || candles.length < 30) {
        newLogs.push({
          id: uid(), timestamp: now, type: "scan",
          message: `⚠️ SCAN ${label} — Pas assez de bougies (${candles?.length ?? 0}/30)`,
        });
        continue;
      }

      // Compute technical signal only (RSI + SMA + momentum + 24h change)
      let techSignal: AISignalResult | null = null;
      try {
        techSignal = computeAISignal(candles);
      } catch (err) {
        newLogs.push({
          id: uid(), timestamp: now, type: "scan",
          message: `❌ SCAN ${label} — Erreur calcul signal: ${err instanceof Error ? err.message : "unknown"}`,
        });
        continue;
      }

      const score = techSignal?.globalScore ?? 0;
      const absScore = Math.abs(score);
      const threshold = strat.scoreThreshold;

      // SCAN LOG — always emit to diagnose why no trade
      const scanMsg = `🔍 SCAN ${label} @ $${currentPrice.toFixed(2)} — Score: ${score.toFixed(1)} | Seuil: ${threshold} | ${absScore >= threshold ? "✅ OK" : "❌ Sous seuil"}`;
      console.log(`[bot-scan] ${scanMsg}`);
      newLogs.push({
        id: uid(), timestamp: now, type: "scan",
        message: scanMsg,
      });

      if (absScore < threshold) continue;

      // Determine direction from score sign
      const direction: TradeDirection = score > 0 ? "LONG" : "SHORT";

      // --- ANTI-TRADE FILTERS DISABLED (kept for future re-enable) ---
      // const combinedHistory = [...history, ...closedTrades];
      // const consecutiveLosses = countConsecutiveLosses(combinedHistory);
      // const hourUTC = new Date(now).getUTCHours();
      // const antiTradeResult = evaluateAntiTradeFilters({
      //   recentTrades: combinedHistory.slice(-10),
      //   currentHourUTC: hourUTC,
      //   regime: "ranging",
      //   sentiment: null,
      //   consecutiveLosses,
      //   currentDrawdownPct: state.currentDrawdown,
      //   maxDrawdownPct: config.maxDrawdownPct,
      // }, direction);
      // if (!antiTradeResult.shouldTrade) {
      //   newLogs.push({
      //     id: uid(), timestamp: now, type: "info",
      //     message: `🚫 BLOCKED ${direction} ${label} — ${antiTradeResult.reasons.join(", ")}`,
      //   });
      //   continue;
      // }

      // --- Simple position sizing: strategy % of portfolio, adjusted by allocation ---
      const allocationPct = config.allocations[crypto.symbol] / 100;
      const size = Math.round(state.portfolioValue * (strat.positionSizePct / 100) * allocationPct * 3);
      // (x3 because allocation splits across 3 cryptos — each gets ~1/3)

      const entryPrice = applySpreadSlip(currentPrice, direction, true);

      // Static SL/TP from strategy
      const stopLoss = direction === "LONG"
        ? entryPrice * (1 - strat.stopLossPct / 100)
        : entryPrice * (1 + strat.stopLossPct / 100);
      const takeProfit = direction === "LONG"
        ? entryPrice * (1 + strat.takeProfitPct / 100)
        : entryPrice * (1 - strat.takeProfitPct / 100);

      const newPos: OpenPosition = {
        id: uid(), crypto: crypto.symbol, direction, entryPrice, entryTime: now,
        size, stopLoss, takeProfit,
        trailingStopPrice: config.trailingStop ? stopLoss : null,
        currentPrice, pnl: 0, pnlPct: 0,
      };
      positions.push(newPos);
      state.lastTradeTime[crypto.symbol] = now;

      newLogs.push({
        id: uid(), timestamp: now, type: "open",
        message: `✅ OPEN ${direction} ${label} @ $${entryPrice.toFixed(2)} — Size: $${size} — SL: $${stopLoss.toFixed(2)} — TP: $${takeProfit.toFixed(2)} — Score: ${score.toFixed(1)}`,
      });
    }

    // ---- Recompute portfolio value FROM SCRATCH (stateless, idempotent) ----
    // Formula: portfolioValue = initialCapital + totalClosedPnL + totalOpenPnL
    // NEVER accumulate open PnL across ticks — it must be recalculated each run
    const allHistory = [...history, ...closedTrades];
    const totalClosedPnL = allHistory.reduce((sum, t) => sum + t.pnl, 0);
    const totalOpenPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
    state.portfolioValue = config.initialCapital + totalClosedPnL + totalOpenPnL;

    if (state.portfolioValue > state.peakValue) state.peakValue = state.portfolioValue;
    state.currentDrawdown = state.peakValue > 0
      ? ((state.peakValue - state.portfolioValue) / state.peakValue) * 100
      : 0;

    curvePoints.push({ t: now, v: state.portfolioValue });

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
      engine: "v4-simplified",
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
