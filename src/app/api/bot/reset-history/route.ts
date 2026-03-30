// ============================================
// POST /api/bot/reset-history
// Resets bot data and generates fresh history using REAL historical prices
// Admin only — deterministic seed based on userId for reproducibility
// ============================================

import { verifyToken } from "@/lib/auth-server";
import { getRedis, REDIS_KEYS } from "@/lib/redis";
import type {
  BotConfig,
  BotState,
  ClosedTrade,
  PortfolioPoint,
  LogEntry,
  TradedCrypto,
  TradeDirection,
} from "@/lib/bot/types";
import { DEFAULT_CONFIG, DEFAULT_STATE, STRATEGIES } from "@/lib/bot/types";

export const dynamic = "force-dynamic";

// ---- Seeded PRNG (Mulberry32) ----
// Deterministic random number generator seeded from a string
// Same userId + same config = same history every time

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

function createSeededRng(seed: string): () => number {
  let state = hashString(seed);
  // Mulberry32 PRNG
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PricePoint {
  t: number;
  p: number;
}

function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

const DELAY_BETWEEN_CG = 1500;
const RETRY_DELAY = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOnce(coinId: string, days: number): Promise<PricePoint[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.prices ?? []).map(([t, p]: [number, number]) => ({ t, p }));
  } catch {
    return [];
  }
}

// Sequential fetch with Redis cache + retry
async function fetchHistoricalPrices(coinId: string, days: number): Promise<PricePoint[]> {
  const redis = getRedis();
  const cacheKey = `axiom:cache:hist:${coinId}:${days}d`;

  // Check Redis cache (60s TTL)
  try {
    const cached = await redis.get<PricePoint[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
  } catch { /* continue */ }

  // First attempt
  let result = await fetchOnce(coinId, days);

  // Retry once after 2s if failed
  if (result.length === 0) {
    await sleep(RETRY_DELAY);
    result = await fetchOnce(coinId, days);
  }

  // Cache on success
  if (result.length > 0) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: 60 });
    } catch { /* non-critical */ }
  }

  return result;
}

function generateHistoryFromPrices(
  priceHistory: Record<string, PricePoint[]>,
  config: BotConfig,
  rng: () => number,
): { trades: ClosedTrade[]; curve: PortfolioPoint[]; finalValue: number } {
  const strat = STRATEGIES[config.strategy];
  const trades: ClosedTrade[] = [];
  const curve: PortfolioPoint[] = [];
  let portfolioValue = config.initialCapital;
  let tradeNum = 1;

  // Deterministic uid using seeded rng
  function uid(): string {
    return Math.floor(rng() * 0xffffffff).toString(36) + Math.floor(rng() * 0xffffffff).toString(36);
  }

  const cryptos: { symbol: TradedCrypto; id: string; label: string }[] = [
    { symbol: "BTCUSDT", id: "bitcoin", label: "BTC" },
    { symbol: "ETHUSDT", id: "ethereum", label: "ETH" },
    { symbol: "SOLUSDT", id: "solana", label: "SOL" },
  ];

  // Generate trades spread across the last 7 days
  const numTrades = 8 + Math.floor(rng() * 5); // 8-12 trades

  // Collect valid time indices for each crypto
  const validCryptos = cryptos.filter(c => priceHistory[c.id] && priceHistory[c.id].length > 10);
  if (validCryptos.length === 0) return { trades: [], curve: [], finalValue: config.initialCapital };

  // Sort trade open times chronologically
  const tradeSlots: { crypto: typeof validCryptos[0]; openIdx: number }[] = [];
  for (let i = 0; i < numTrades; i++) {
    const crypto = validCryptos[Math.floor(rng() * validCryptos.length)];
    const prices = priceHistory[crypto.id];
    const maxOpen = Math.max(0, prices.length - 6);
    const openIdx = Math.floor(rng() * maxOpen);
    tradeSlots.push({ crypto, openIdx });
  }
  tradeSlots.sort((a, b) => {
    const aTime = priceHistory[a.crypto.id][a.openIdx]?.t ?? 0;
    const bTime = priceHistory[b.crypto.id][b.openIdx]?.t ?? 0;
    return aTime - bTime;
  });

  // Record initial portfolio point
  if (validCryptos.length > 0) {
    const firstPrices = priceHistory[validCryptos[0].id];
    if (firstPrices.length > 0) {
      curve.push({ t: firstPrices[0].t, v: portfolioValue });
    }
  }

  for (const slot of tradeSlots) {
    const prices = priceHistory[slot.crypto.id];
    const duration = 2 + Math.floor(rng() * 8); // 2-10 hours
    const closeIdx = Math.min(slot.openIdx + duration, prices.length - 1);

    const realOpenPrice = prices[slot.openIdx].p;
    const realClosePrice = prices[closeIdx].p;
    const openTimestamp = prices[slot.openIdx].t;
    const closeTimestamp = prices[closeIdx].t;

    // Tiny spread (deterministic)
    const spreadOpen = realOpenPrice * (0.0003 + rng() * 0.0005);
    const spreadClose = realClosePrice * (0.0003 + rng() * 0.0005);

    // Determine direction based on price movement tendency
    const priceChange = (realClosePrice - realOpenPrice) / realOpenPrice;
    const direction: TradeDirection = rng() < 0.6
      ? (priceChange > 0 ? "LONG" : "SHORT")
      : (priceChange > 0 ? "SHORT" : "LONG"); // Some trades go against the trend

    const entryPrice = roundPrice(direction === "LONG" ? realOpenPrice + spreadOpen : realOpenPrice - spreadOpen);
    const exitPrice = roundPrice(direction === "LONG" ? realClosePrice - spreadClose : realClosePrice + spreadClose);

    const size = Math.round(portfolioValue * (strat.positionSizePct / 100));
    const diff = direction === "LONG"
      ? (exitPrice - entryPrice) / entryPrice
      : (entryPrice - exitPrice) / entryPrice;
    const pnl = Math.round(size * diff * 100) / 100;
    const pnlPct = Math.round(diff * 10000) / 100;

    // Determine close reason
    let closeReason: ClosedTrade["closeReason"];
    if (pnl > 0 && Math.abs(pnlPct) > strat.takeProfitPct * 0.8) closeReason = "take_profit";
    else if (pnl < 0 && Math.abs(pnlPct) > strat.stopLossPct * 0.8) closeReason = "stop_loss";
    else if (pnl > 0 && rng() < 0.3) closeReason = "trailing_stop";
    else closeReason = "signal_reversed";

    trades.push({
      id: uid(),
      tradeNumber: tradeNum++,
      crypto: slot.crypto.symbol,
      direction,
      entryPrice,
      exitPrice,
      entryTime: openTimestamp,
      exitTime: closeTimestamp,
      size,
      pnl,
      pnlPct,
      result: pnl >= 0 ? "win" : "loss",
      closeReason,
    });

    portfolioValue += pnl;
    curve.push({ t: closeTimestamp, v: portfolioValue });
  }

  return { trades, curve, finalValue: portfolioValue };
}

export async function POST(request: Request) {
  // Auth check
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader.match(/axiom_token=([^;]+)/);
  if (!tokenMatch) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const payload = verifyToken(tokenMatch[1]);
  if (!payload || payload.role !== "admin") {
    return Response.json({ error: "Admin uniquement" }, { status: 403 });
  }

  try {
    const redis = getRedis();

    // Load config to know initial capital
    const rawConfig = await redis.get<BotConfig>(REDIS_KEYS.botConfig);
    const config: BotConfig = rawConfig ? { ...DEFAULT_CONFIG, ...rawConfig } : { ...DEFAULT_CONFIG };

    // Create deterministic RNG seeded from userId + strategy
    // Same user with same config always gets the same history
    const seedString = `${payload.userId}:${config.strategy}:${config.initialCapital}`;
    const rng = createSeededRng(seedString);

    // Fetch REAL historical prices from CoinGecko (7 days hourly)
    // Sequential with 1.5s delay to avoid rate-limiting
    const btcPrices = await fetchHistoricalPrices("bitcoin", 7);
    await sleep(DELAY_BETWEEN_CG);
    const ethPrices = await fetchHistoricalPrices("ethereum", 7);
    await sleep(DELAY_BETWEEN_CG);
    const solPrices = await fetchHistoricalPrices("solana", 7);

    const priceHistory: Record<string, PricePoint[]> = {
      bitcoin: btcPrices,
      ethereum: ethPrices,
      solana: solPrices,
    };

    const hasPrices = btcPrices.length > 0 || ethPrices.length > 0 || solPrices.length > 0;
    if (!hasPrices) {
      return Response.json({ error: "Impossible de récupérer les prix historiques" }, { status: 502 });
    }

    // Generate deterministic history from real prices
    const { trades, curve, finalValue } = generateHistoryFromPrices(priceHistory, config, rng);

    // Deterministic uid for logs
    function logId(): string {
      return Math.floor(rng() * 0xffffffff).toString(36) + Math.floor(rng() * 0xffffffff).toString(36);
    }

    // Reset state
    const newState: BotState = {
      ...DEFAULT_STATE,
      portfolioValue: finalValue,
      peakValue: Math.max(finalValue, config.initialCapital),
      currentDrawdown: finalValue < config.initialCapital
        ? ((config.initialCapital - finalValue) / config.initialCapital) * 100
        : 0,
      initialized: true,
    };

    const logs: LogEntry[] = [
      {
        id: logId(),
        timestamp: Date.now(),
        type: "info",
        message: `🔄 Historique réinitialisé avec ${trades.length} trades basés sur les vrais prix CoinGecko des 7 derniers jours`,
      },
      {
        id: logId(),
        timestamp: Date.now(),
        type: "info",
        message: `📊 Portfolio : $${finalValue.toFixed(2)} (${((finalValue - config.initialCapital) / config.initialCapital * 100).toFixed(2)}%)`,
      },
    ];

    // Save everything to Redis
    await Promise.all([
      redis.set(REDIS_KEYS.botState, JSON.stringify(newState)),
      redis.set(REDIS_KEYS.botPositions, JSON.stringify([])),
      redis.set(REDIS_KEYS.botHistory, JSON.stringify(trades)),
      redis.set(REDIS_KEYS.botCurve, JSON.stringify(curve)),
      redis.set(REDIS_KEYS.botLogs, JSON.stringify(logs)),
    ]);

    return Response.json({
      success: true,
      tradesGenerated: trades.length,
      wins: trades.filter(t => t.result === "win").length,
      losses: trades.filter(t => t.result === "loss").length,
      finalValue: roundPrice(finalValue),
      pnlPct: roundPrice(((finalValue - config.initialCapital) / config.initialCapital) * 100),
    });
  } catch (err) {
    console.error("Reset history error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
