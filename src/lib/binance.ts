// ============================================
// Binance Public API — OHLCV data fetcher
// No API key required for public market data
// ============================================

import { type OHLCV, type CryptoSymbol, TIMEFRAMES, type TimeframeLabel } from "./indicators/types";

const BASE_URL = "https://api.binance.com/api/v3";
const CACHE_TTL = 55_000; // 55s — refresh every ~60s

interface CacheEntry {
  data: OHLCV[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(symbol: string, interval: string): string {
  return `${symbol}_${interval}`;
}

export async function fetchOHLCV(
  symbol: CryptoSymbol,
  timeframeLabel: TimeframeLabel,
  limit = 200
): Promise<OHLCV[]> {
  const tf = TIMEFRAMES.find((t) => t.label === timeframeLabel);
  if (!tf) throw new Error(`Unknown timeframe: ${timeframeLabel}`);

  const cacheKey = getCacheKey(symbol, tf.interval);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${tf.interval}&limit=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // If Binance fails, return cached data if available
      if (cached) return cached.data;
      throw new Error(`Binance API error: ${res.status}`);
    }

    const raw: unknown[][] = await res.json();

    const data: OHLCV[] = raw.map((k) => ({
      time: Math.floor((k[0] as number) / 1000), // Convert ms to seconds
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    // Return cached data on failure
    if (cached) return cached.data;
    throw err;
  }
}

// Fetch current price for a symbol
export async function fetchCurrentPrice(symbol: CryptoSymbol): Promise<number> {
  try {
    const res = await fetch(`${BASE_URL}/ticker/price?symbol=${symbol}`);
    if (!res.ok) return 0;
    const data: { price: string } = await res.json();
    return parseFloat(data.price);
  } catch {
    return 0;
  }
}
