// ============================================
// Cron Job: /api/bot/run — Runs every 5 minutes via Vercel Cron
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
import { runTick } from "@/lib/bot/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30s max for cron

export async function GET(request: Request) {
  // Verify CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await loadStateRedis();

    // Bot not running — skip
    if (!state.running) {
      return Response.json({ status: "skipped", reason: "Bot not running" });
    }

    const config = await loadConfigRedis();
    const positions = await loadPositionsRedis();
    const history = await loadHistoryRedis();
    const curve = await loadCurveRedis();
    const logs = await loadLogsRedis();

    // Run one tick
    const result = await runTick(config, state, positions, history);

    // Update state
    const newState = { ...state };
    newState.portfolioValue = result.portfolioValue;
    if (result.portfolioValue > newState.peakValue) {
      newState.peakValue = result.portfolioValue;
    }
    newState.currentDrawdown = newState.peakValue > 0
      ? ((newState.peakValue - result.portfolioValue) / newState.peakValue) * 100
      : 0;

    // Update today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayPnl = result.closedTrades
      .filter((t) => t.exitTime >= todayStart.getTime())
      .reduce((sum, t) => sum + t.pnl, 0) + state.todayPnl;
    newState.todayPnl = todayPnl;
    newState.todayTradeCount = state.todayTradeCount + result.closedTrades.length;

    // Update last trade times
    for (const trade of result.closedTrades) {
      newState.lastTradeTime[trade.crypto] = trade.exitTime;
    }
    for (const pos of result.positions) {
      if (!positions.find((p) => p.id === pos.id)) {
        newState.lastTradeTime[pos.crypto] = pos.entryTime;
      }
    }

    // Check max drawdown auto-stop
    if (newState.currentDrawdown >= config.maxDrawdownPct) {
      newState.running = false;
      result.logs.push({
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        timestamp: Date.now(),
        type: "warning",
        message: `MAX DRAWDOWN ATTEINT (${newState.currentDrawdown.toFixed(1)}%) — Bot arrêté automatiquement`,
      });
    }

    // Build new history
    const newHistory = [...history, ...result.closedTrades];

    // Build new curve
    const newCurve = [...curve, { t: Date.now(), v: result.portfolioValue }];

    // Build new logs
    const newLogs = [...logs, ...result.logs];

    // Save everything to Redis
    await Promise.all([
      saveStateRedis(newState),
      savePositionsRedis(result.positions),
      saveHistoryRedis(newHistory),
      saveCurveRedis(newCurve),
      saveLogsRedis(newLogs),
    ]);

    return Response.json({
      status: "ok",
      portfolioValue: result.portfolioValue,
      openPositions: result.positions.length,
      closedTrades: result.closedTrades.length,
      drawdown: newState.currentDrawdown.toFixed(2),
      running: newState.running,
    });
  } catch (err) {
    console.error("Bot cron error:", err);
    return Response.json(
      { status: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
