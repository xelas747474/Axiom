// ============================================
// GET /api/market/ohlcv — Fetch historical OHLCV data for backtesting
// Cached in Redis (1h TTL since historical data doesn't change)
// Sequential CoinGecko calls with retry
// ============================================

import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const VALID_CRYPTOS = ["bitcoin", "ethereum", "solana"];
const VALID_DAYS = ["30", "90", "180", "365"];

async function fetchOnce(url: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get("crypto") || "bitcoin";
  const days = searchParams.get("days") || "90";

  if (!VALID_CRYPTOS.includes(crypto)) {
    return Response.json({ error: "Invalid crypto" }, { status: 400 });
  }
  if (!VALID_DAYS.includes(days)) {
    return Response.json({ error: "Invalid period (30, 90, 180, 365)" }, { status: 400 });
  }

  const redis = getRedis();
  const cacheKey = `axiom:cache:ohlcv:${crypto}:${days}d`;

  // Check Redis cache (1h TTL — historical data doesn't change)
  try {
    const cached = await redis.get<unknown>(cacheKey);
    if (cached) return Response.json(cached);
  } catch { /* continue */ }

  // Fetch from CoinGecko
  const daysNum = parseInt(days, 10);

  // Use OHLC endpoint for better data (gives real OHLC candles)
  const ohlcUrl = `https://api.coingecko.com/api/v3/coins/${crypto}/ohlc?vs_currency=usd&days=${days}`;
  let ohlcData = await fetchOnce(ohlcUrl);

  // Retry once after 2s
  if (!ohlcData) {
    await sleep(2000);
    ohlcData = await fetchOnce(ohlcUrl);
  }

  if (!ohlcData || !Array.isArray(ohlcData) || ohlcData.length === 0) {
    return Response.json({ error: "Failed to fetch OHLCV data" }, { status: 502 });
  }

  // CoinGecko OHLC format: [timestamp, open, high, low, close]
  const ohlcv = (ohlcData as number[][]).map((candle: number[]) => ({
    timestamp: candle[0],
    open: candle[1],
    high: candle[2],
    low: candle[3],
    close: candle[4],
    volume: 0, // OHLC endpoint doesn't provide volume, but we don't need it for backtest scoring
  }));

  // Also fetch market_chart for volume data
  await sleep(1500);
  const mcUrl = `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart?vs_currency=usd&days=${days}`;
  const mcData = await fetchOnce(mcUrl) as { total_volumes?: [number, number][] } | null;

  // Merge volume data if available
  if (mcData?.total_volumes) {
    const volumes = mcData.total_volumes;
    for (const candle of ohlcv) {
      // Find nearest volume point
      let bestDist = Infinity;
      for (const [t, v] of volumes) {
        const dist = Math.abs(t - candle.timestamp);
        if (dist < bestDist) {
          bestDist = dist;
          candle.volume = v;
        }
        if (dist > bestDist) break; // volumes are sorted
      }
    }
  }

  const result = {
    crypto,
    days: daysNum,
    count: ohlcv.length,
    data: ohlcv,
  };

  // Cache for 1 hour
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: 3600 });
  } catch { /* non-critical */ }

  return Response.json(result);
}
