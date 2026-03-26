import { authenticateRequest } from "@/lib/auth-server";
import {
  loadPositionsRedis,
  loadHistoryRedis,
  loadStateRedis,
  loadCurveRedis,
  loadLogsRedis,
  savePositionsRedis,
  saveHistoryRedis,
  saveStateRedis,
  saveCurveRedis,
  saveLogsRedis,
} from "@/lib/bot/redis-storage";
import { closePosition } from "@/lib/bot/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { positionId } = await request.json();
    if (!positionId) {
      return Response.json({ error: "positionId requis" }, { status: 400 });
    }

    const [positions, history, state, curve, logs] = await Promise.all([
      loadPositionsRedis(),
      loadHistoryRedis(),
      loadStateRedis(),
      loadCurveRedis(),
      loadLogsRedis(),
    ]);

    const posIndex = positions.findIndex((p) => p.id === positionId);
    if (posIndex === -1) {
      return Response.json({ error: "Position introuvable" }, { status: 404 });
    }

    const pos = positions[posIndex];
    const tradeNumber = history.length + 1;
    const trade = closePosition(pos, pos.currentPrice, "manual", tradeNumber);

    // Remove from positions
    const newPositions = positions.filter((p) => p.id !== positionId);

    // Add to history
    const newHistory = [...history, trade];

    // Update state
    const newState = { ...state };
    newState.portfolioValue += trade.pnl;
    if (newState.portfolioValue > newState.peakValue) {
      newState.peakValue = newState.portfolioValue;
    }
    newState.todayPnl += trade.pnl;
    newState.todayTradeCount += 1;
    newState.lastTradeTime[trade.crypto] = trade.exitTime;

    // Add curve point
    const newCurve = [...curve, { t: Date.now(), v: newState.portfolioValue }];

    // Add log
    const label = pos.crypto === "BTCUSDT" ? "BTC" : pos.crypto === "ETHUSDT" ? "ETH" : "SOL";
    const newLogs = [...logs, {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      timestamp: Date.now(),
      type: "close" as const,
      message: `CLOSE MANUAL ${pos.direction} ${label} @ $${pos.currentPrice.toFixed(2)} — P&L: ${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`,
    }];

    await Promise.all([
      savePositionsRedis(newPositions),
      saveHistoryRedis(newHistory),
      saveStateRedis(newState),
      saveCurveRedis(newCurve),
      saveLogsRedis(newLogs),
    ]);

    return Response.json({ trade, state: newState });
  } catch (err) {
    console.error("Close position error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
