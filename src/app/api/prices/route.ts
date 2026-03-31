// ============================================
// GET /api/prices — Centralized price source for ALL pages
// Primary: Binance via market-data.ts | Fallback: CoinGecko direct
// Redis cache (15s TTL)
// ============================================

import { getCurrentPrices } from "@/lib/market-data";
import { COINGECKO_IDS } from "@/lib/binance";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// CoinPrice interface expected by usePrices hook and all frontend components
export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] } | null;
}

const COIN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  DOT: "Polkadot",
  MATIC: "Polygon",
};

// Rough market cap estimates for sorting (updated periodically)
const MARKET_CAP_RANK: Record<string, number> = {
  BTC: 1, ETH: 2, BNB: 3, SOL: 4, XRP: 5,
  ADA: 6, AVAX: 7, DOT: 8, LINK: 9, MATIC: 10,
};

const SPARKLINE_CACHE_KEY = "axiom:cache:sparklines";
const SPARKLINE_TTL = 300; // 5 min — sparklines don't need to be super fresh

export async function GET() {
  try {
    const redis = getRedis();

    // Get prices from Binance (via market-data abstraction)
    const prices = await getCurrentPrices();

    if (Object.keys(prices).length === 0) {
      // Total failure — try CoinGecko direct as emergency fallback
      return await fallbackCoinGecko(redis);
    }

    // Load sparkline data from cache (fetched separately, less often)
    let sparklines: Record<string, number[]> = {};
    try {
      const cached = await redis.get<Record<string, number[]>>(SPARKLINE_CACHE_KEY);
      if (cached) sparklines = cached;
    } catch { /* no sparklines is fine */ }

    // If sparklines are empty, try to fetch them in the background
    if (Object.keys(sparklines).length === 0) {
      // Don't await — fire and forget
      fetchAndCacheSparklines(redis).catch(() => {});
    }

    // Convert to CoinPrice format expected by frontend
    const coins: CoinPrice[] = Object.entries(prices)
      .filter(([sym]) => COIN_NAMES[sym])
      .sort((a, b) => (MARKET_CAP_RANK[a[0]] ?? 99) - (MARKET_CAP_RANK[b[0]] ?? 99))
      .map(([sym, data]) => ({
        id: COINGECKO_IDS[sym] ?? sym.toLowerCase(),
        symbol: sym.toLowerCase(),
        name: COIN_NAMES[sym] ?? sym,
        current_price: data.price,
        price_change_percentage_1h_in_currency: null, // Binance 24hr ticker doesn't have 1h
        price_change_percentage_24h: data.change24h,
        price_change_percentage_7d_in_currency: null, // Not available from Binance ticker
        market_cap: data.volume24h * 10, // Rough estimate from volume
        total_volume: data.volume24h,
        sparkline_in_7d: sparklines[sym] ? { price: sparklines[sym] } : null,
      }));

    return Response.json({
      coins,
      source: "live" as const,
      dataSource: "binance",
      fetchedAt: Date.now(),
    });
  } catch (err) {
    // On any error, try Redis stale cache
    try {
      const redis = getRedis();
      const cached = await redis.get<{ coins: CoinPrice[]; fetchedAt: number }>("axiom:cache:prices:legacy");
      if (cached?.coins) {
        return Response.json({
          coins: cached.coins,
          source: "stale-cache",
          fetchedAt: cached.fetchedAt,
        });
      }
    } catch { /* give up */ }

    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Fetch sparkline data from CoinGecko (runs infrequently, cached 5min)
async function fetchAndCacheSparklines(redis: ReturnType<typeof getRedis>) {
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&per_page=10&page=1`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return;
    const data = await res.json();

    const sparklines: Record<string, number[]> = {};
    for (const coin of data) {
      const sym = Object.entries(COINGECKO_IDS).find(([, id]) => id === coin.id)?.[0];
      if (sym && coin.sparkline_in_7d?.price) {
        sparklines[sym] = coin.sparkline_in_7d.price;
      }
    }

    if (Object.keys(sparklines).length > 0) {
      await redis.set(SPARKLINE_CACHE_KEY, JSON.stringify(sparklines), { ex: SPARKLINE_TTL });
    }
  } catch { /* non-critical */ }
}

// Emergency CoinGecko fallback
async function fallbackCoinGecko(redis: ReturnType<typeof getRedis>) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d",
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("CoinGecko unavailable");
    const coins: CoinPrice[] = await res.json();

    return Response.json({
      coins,
      source: "live",
      dataSource: "coingecko-fallback",
      fetchedAt: Date.now(),
    });
  } catch {
    // Try stale cache
    try {
      const cached = await redis.get<{ coins: CoinPrice[]; fetchedAt: number }>("axiom:cache:prices:legacy");
      if (cached?.coins) {
        return Response.json({ coins: cached.coins, source: "stale-cache", fetchedAt: cached.fetchedAt });
      }
    } catch { /* give up */ }

    return Response.json({ error: "All price sources unavailable" }, { status: 502 });
  }
}
