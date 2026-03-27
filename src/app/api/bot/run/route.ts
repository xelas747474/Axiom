// ============================================
// Cron Job: /api/bot/run — Runs ONCE daily via Vercel Cron (Hobby plan)
// Simulates 24h of trading retroactively by iterating hourly candles
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

// ---- Simulate one hour tick ----

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

    // Compute signal from candles up to this hour (need at least 30)
    let signal: AISignalResult | null = null;
    const sliceEnd = hourIndex + 1;
    const sliceStart = Math.max(0, sliceEnd - 100);
    const candleSlice = candles.slice(sliceStart, sliceEnd);
    if (candleSlice.length >= 30) {
      try {
        signal = computeAISignal(candleSlice);
      } catch {
        // Skip if computation fails
      }
    }

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

      // Check signal reversal
      if (signal) {
        const score = signal.globalScore;
        const reversed = (pos.direction === "LONG" && score < -30) || (pos.direction === "SHORT" && score > 30);
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
            message: `🔄 CLOSE ${pos.direction} ${crypto.label} @ $${currentPrice.toFixed(2)} — P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} — Signal inversé`,
          });
          continue;
        }
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

    // ---- Evaluate new entries ----
    if (!signal) continue;
    const hasPosition = currentPositions.some((p) => p.crypto === crypto.symbol);
    if (hasPosition) continue;
    if (currentPositions.length >= config.maxConcurrentTrades) continue;

    // Check cooldown
    const lastTrade = state.lastTradeTime[crypto.symbol] ?? 0;
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    if (hourTimestamp - lastTrade < cooldownMs && lastTrade > 0) continue;

    // Evaluate entry
    const score = signal.globalScore;
    const absScore = Math.abs(score);
    if (absScore < strat.scoreThreshold) continue;

    // Check conditions (3/5 required)
    const momentum = signal.categories.find((c) => c.category === "Momentum");
    const trend = signal.categories.find((c) => c.category === "Tendance" || c.category === "Trend");
    const volume = signal.categories.find((c) => c.category === "Volume");
    const rsiScore = momentum?.indicators.find((i) => i.name === "RSI")?.score ?? 0;
    const macdScore = trend?.indicators.find((i) => i.name === "MACD")?.score ?? 0;
    const smaScore = trend?.indicators.find((i) => i.name.includes("SMA") || i.name.includes("EMA"))?.score ?? 0;
    const volumeScore = volume?.indicators.find((i) => i.name.includes("Volume") || i.name.includes("OBV"))?.score ?? 0;

    let direction: TradeDirection | null = null;
    if (score > strat.scoreThreshold) {
      const conditions = [true, rsiScore > -50, macdScore > -10, smaScore > -20, volumeScore > -20];
      if (conditions.filter(Boolean).length >= 3) direction = "LONG";
    } else if (score < -strat.scoreThreshold) {
      const conditions = [true, rsiScore < 50, macdScore < 10, smaScore < 20, volumeScore > -20];
      if (conditions.filter(Boolean).length >= 3) direction = "SHORT";
    }

    if (!direction) continue;

    // Open position
    const allocation = config.allocations[crypto.symbol] / 100;
    const maxSize = state.portfolioValue * (strat.positionSizePct / 100) * allocation * (100 / Math.max(config.allocations[crypto.symbol], 1));
    const size = Math.min(maxSize, state.portfolioValue * (strat.positionSizePct / 100));
    const entryPrice = applySpreadSlip(currentPrice, direction, true);
    const stopLoss = direction === "LONG"
      ? entryPrice * (1 - strat.stopLossPct / 100)
      : entryPrice * (1 + strat.stopLossPct / 100);
    const takeProfit = direction === "LONG"
      ? entryPrice * (1 + strat.takeProfitPct / 100)
      : entryPrice * (1 - strat.takeProfitPct / 100);

    const newPos: OpenPosition = {
      id: uid(),
      crypto: crypto.symbol,
      direction,
      entryPrice,
      entryTime: hourTimestamp,
      size,
      stopLoss,
      takeProfit,
      trailingStopPrice: config.trailingStop ? stopLoss : null,
      currentPrice,
      pnl: 0,
      pnlPct: 0,
    };
    currentPositions.push(newPos);
    state.lastTradeTime[crypto.symbol] = hourTimestamp;

    logs.push({
      id: uid(), timestamp: hourTimestamp, type: "open" as const,
      message: `✅ OPEN ${direction} ${crypto.label} @ $${entryPrice.toFixed(2)} — Size: $${size.toFixed(0)} — SL: $${stopLoss.toFixed(2)} — TP: $${takeProfit.toFixed(2)}`,
    });
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

    // Start simulation from 24h ago (or whatever data we have)
    const startIndex = Math.max(0, maxCandles - 24);
    const simState = { ...state };
    let simPositions = [...positions];
    const allClosedTrades: ClosedTrade[] = [];
    const allLogs: LogEntry[] = [];
    const allCurvePoints: PortfolioPoint[] = [];

    // Add start log
    allLogs.push({
      id: uid(),
      timestamp: Date.now(),
      type: "info" as const,
      message: `🤖 Batch journalier — Simulation de ${maxCandles - startIndex}h de trading...`,
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
    allLogs.push({
      id: uid(),
      timestamp: Date.now(),
      type: "info" as const,
      message: `📊 Résumé journalier — Portfolio: $${simState.portfolioValue.toFixed(2)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%) — ${allClosedTrades.length} trades — ${allClosedTrades.filter((t) => t.result === "win").length}W/${allClosedTrades.filter((t) => t.result === "loss").length}L`,
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
      hoursSimulated: maxCandles - Math.max(0, maxCandles - 24),
      portfolioValue: simState.portfolioValue,
      openPositions: simPositions.length,
      closedTrades: allClosedTrades.length,
      wins: allClosedTrades.filter((t) => t.result === "win").length,
      losses: allClosedTrades.filter((t) => t.result === "loss").length,
      drawdown: simState.currentDrawdown.toFixed(2),
      running: simState.running,
    });
  } catch (err) {
    console.error("Bot daily cron error:", err);
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
