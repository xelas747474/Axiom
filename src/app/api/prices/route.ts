// ============================================
// GET /api/prices — Centralized price source for ALL pages
// Uses Redis cache (30s TTL) to avoid CoinGecko rate limits
// ============================================

import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d";

const CACHE_KEY = "axiom:cache:prices";
const CACHE_TTL = 30; // seconds

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

interface CachedPrices {
  coins: CoinPrice[];
  fetchedAt: number;
}

export async function GET() {
  try {
    const redis = getRedis();

    // Try Redis cache first
    const cached = await redis.get<CachedPrices>(CACHE_KEY);
    if (cached && cached.coins && Date.now() - cached.fetchedAt < CACHE_TTL * 1000) {
      return Response.json({
        coins: cached.coins,
        source: "cache",
        fetchedAt: cached.fetchedAt,
      });
    }

    // Fetch fresh from CoinGecko
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // CoinGecko failed — return stale cache if available
      if (cached && cached.coins) {
        return Response.json({
          coins: cached.coins,
          source: "stale-cache",
          fetchedAt: cached.fetchedAt,
        });
      }
      return Response.json({ error: "CoinGecko unavailable" }, { status: 502 });
    }

    const coins: CoinPrice[] = await res.json();
    const now = Date.now();

    // Save to Redis with TTL
    await redis.set(CACHE_KEY, JSON.stringify({ coins, fetchedAt: now }), { ex: CACHE_TTL * 3 });

    return Response.json({
      coins,
      source: "live",
      fetchedAt: now,
    });
  } catch (err) {
    // On any error, try Redis cache as fallback
    try {
      const redis = getRedis();
      const cached = await redis.get<CachedPrices>(CACHE_KEY);
      if (cached && cached.coins) {
        return Response.json({
          coins: cached.coins,
          source: "stale-cache",
          fetchedAt: cached.fetchedAt,
        });
      }
    } catch {
      // Redis also failed
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
