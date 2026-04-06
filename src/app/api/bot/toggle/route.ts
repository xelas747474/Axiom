import { authenticateRequest } from "@/lib/auth-server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  loadStateRedis,
  saveStateRedis,
  loadConfigRedis,
  loadHistoryRedis,
  loadCurveRedis,
  loadLogsRedis,
  saveHistoryRedis,
  saveCurveRedis,
  saveLogsRedis,
  savePositionsRedis,
} from "@/lib/bot/redis-storage";
import { generateInitialHistory } from "@/lib/bot/history";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  // 10 toggles per hour per user
  const rl = await rateLimit(user.id, "bot-toggle", 10, 60 * 60);
  if (!rl.allowed) return rateLimitResponse(rl.resetInSeconds);

  try {
    const state = await loadStateRedis();
    const config = await loadConfigRedis();

    if (!state.running) {
      // Starting the bot
      // Check if history needs to be generated (first start)
      if (!state.initialized) {
        const initial = generateInitialHistory(config);
        await Promise.all([
          saveHistoryRedis(initial.history),
          saveCurveRedis(initial.curve),
          saveLogsRedis(initial.logs),
          savePositionsRedis([]),
        ]);

        const newState = {
          ...state,
          running: true,
          startedAt: Date.now(),
          portfolioValue: initial.finalValue,
          peakValue: initial.peakValue,
          currentDrawdown: 0,
          initialized: true,
          todayTradeCount: 0,
          todayPnl: 0,
          lastTradeTime: { BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 },
        };

        await saveStateRedis(newState);
        return Response.json({
          running: true,
          state: newState,
          message: "Bot démarré avec historique initial généré",
        });
      }

      // Already initialized, just toggle on
      const newState = {
        ...state,
        running: true,
        startedAt: Date.now(),
      };
      await saveStateRedis(newState);
      return Response.json({ running: true, state: newState });
    } else {
      // Stopping the bot
      const newState = {
        ...state,
        running: false,
        startedAt: null as number | null,
      };
      await saveStateRedis(newState);
      return Response.json({ running: false, state: newState });
    }
  } catch (err) {
    console.error("Bot toggle error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
