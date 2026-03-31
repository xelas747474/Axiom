// ============================================
// Market Data Abstraction Layer
// THE SINGLE SOURCE OF TRUTH for all market data in AXIOM
// Primary: Binance (multi-endpoint) | Fallback: CoinGecko | Last resort: Redis stale cache
// ============================================

import {
  getAllBinancePrices,
  getBinanceOHLCV,
  getBinanceHistoricalOHLCV,
  getBinancePrice,
  COINGECKO_IDS,
  COINGECKO_TO_SYMBOL,
  type TickerData,
  type OHLCVCandle,
  type BinanceInterval,
} from "./binance";
import { getRedis } from "./redis";

// ============================================
// CURRENT PRICES — all cryptos in one call
// ============================================

export async function getCurrentPrices(): Promise<Record<string, TickerData>> {
  const redis = getRedis();

  // Check Redis cache (15s TTL)
  try {
    const cached = await redis.get<Record<string, TickerData>>("axiom:cache:prices:v2");
    if (cached && Object.keys(cached).length > 0) return cached;
  } catch { /* continue */ }

  // Try Binance (single HTTP call for all tickers)
  const binancePrices = await getAllBinancePrices();
  if (Object.keys(binancePrices).length > 0) {
    try {
      await redis.set("axiom:cache:prices:v2", binancePrices, { ex: 15 });
    } catch { /* non-critical */ }
    return binancePrices;
  }

  // Fallback: CoinGecko
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_low_24h=true`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const mapped: Record<string, TickerData> = {};

      for (const [id, sym] of Object.entries(COINGECKO_TO_SYMBOL)) {
        if (data[id]) {
          mapped[sym] = {
            price: data[id].usd ?? 0,
            change24h: data[id].usd_24h_change ?? 0,
            volume24h: data[id].usd_24h_vol ?? 0,
            high24h: data[id].usd_24h_high ?? 0,
            low24h: data[id].usd_24h_low ?? 0,
          };
        }
      }

      if (Object.keys(mapped).length > 0) {
        try {
          await redis.set("axiom:cache:prices:v2", mapped, { ex: 15 });
        } catch { /* non-critical */ }
        return mapped;
      }
    }
  } catch { /* continue to stale cache */ }

  // Last resort: stale Redis cache
  try {
    const stale = await redis.get<Record<string, TickerData>>("axiom:cache:prices:v2");
    if (stale) return stale;
  } catch { /* give up */ }

  return {};
}

// ============================================
// SINGLE PRICE — for bot cron
// ============================================

export async function getPrice(
  symbol: string
): Promise<{ price: number; change24h: number } | null> {
  const allPrices = await getCurrentPrices();
  if (allPrices[symbol]) {
    return { price: allPrices[symbol].price, change24h: allPrices[symbol].change24h };
  }
  return await getBinancePrice(symbol);
}

// ============================================
// OHLCV — for charts and indicators
// ============================================

export async function getOHLCV(
  symbol: string,
  interval: BinanceInterval = "1h",
  limit: number = 200
): Promise<OHLCVCandle[]> {
  const redis = getRedis();
  const cacheKey = `axiom:cache:ohlcv:${symbol}:${interval}:${limit}`;

  // Shorter cache for fast intervals
  const cacheTTL =
    interval === "1m" || interval === "5m" ? 30 :
    interval === "15m" || interval === "1h" ? 60 : 300;

  try {
    const cached = await redis.get<OHLCVCandle[]>(cacheKey);
    if (cached && cached.length > 0) return cached;
  } catch { /* continue */ }

  // Binance primary (with multi-endpoint fallback)
  const data = await getBinanceOHLCV(symbol, interval, limit);
  if (data && data.length > 0) {
    try {
      await redis.set(cacheKey, data, { ex: cacheTTL });
    } catch { /* non-critical */ }
    return data;
  }

  // CoinGecko OHLC fallback
  const cgData = await fetchCoinGeckoOHLC(symbol, intervalToDays(interval, limit));
  if (cgData.length > 0) {
    try {
      await redis.set(cacheKey, cgData, { ex: cacheTTL });
    } catch { /* non-critical */ }
    return cgData;
  }

  return [];
}

// ============================================
// HISTORICAL OHLCV — for backtest
// ============================================

export async function getHistoricalOHLCV(
  symbol: string,
  days: number
): Promise<OHLCVCandle[]> {
  const redis = getRedis();
  const interval: "1h" | "4h" | "1d" = days <= 7 ? "1h" : days <= 90 ? "4h" : "1d";
  const cacheKey = `axiom:cache:history:${symbol}:${days}d:${interval}`;

  // Cache 1h — historical data doesn't change retroactively
  try {
    const cached = await redis.get<OHLCVCandle[]>(cacheKey);
    if (cached && cached.length > 0) return cached;
  } catch { /* continue */ }

  // Binance primary (multi-endpoint fallback already in getBinanceHistoricalOHLCV)
  const data = await getBinanceHistoricalOHLCV(symbol, interval, days);

  if (data.length > 0) {
    try {
      await redis.set(cacheKey, data, { ex: 3600 });
    } catch { /* non-critical */ }
    return data;
  }

  // CoinGecko OHLC fallback for backtest
  console.log(`[market-data] Binance historical failed for ${symbol}/${days}d, trying CoinGecko`);
  const cgData = await fetchCoinGeckoOHLC(symbol, days);
  if (cgData.length > 0) {
    try {
      await redis.set(cacheKey, cgData, { ex: 3600 });
    } catch { /* non-critical */ }
    return cgData;
  }

  console.error(`[market-data] No OHLCV data available for ${symbol}/${days}d from any source`);
  return [];
}

// ============================================
// CoinGecko OHLC fallback
// ============================================

function intervalToDays(interval: BinanceInterval, limit: number): number {
  const hours: Record<string, number> = {
    "1m": limit / 60, "5m": (limit * 5) / 60, "15m": (limit * 15) / 60,
    "1h": limit / 24, "4h": (limit * 4) / 24, "1d": limit, "1w": limit * 7,
  };
  return Math.max(1, Math.ceil(hours[interval] ?? 7));
}

async function fetchCoinGeckoOHLC(symbol: string, days: number): Promise<OHLCVCandle[]> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) return [];

  // CoinGecko OHLC endpoint: /coins/{id}/ohlc?vs_currency=usd&days=N
  // Available days: 1, 7, 14, 30, 90, 180, 365, max
  const validDays = [1, 7, 14, 30, 90, 180, 365];
  const cgDays = validDays.find((d) => d >= days) ?? 365;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${cgDays}`;
    console.log(`[market-data] CoinGecko OHLC fallback: ${url}`);

    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[market-data] CoinGecko OHLC ${res.status} for ${coinId}`);
      return [];
    }

    // CoinGecko returns [[timestamp, open, high, low, close], ...]
    const raw: number[][] = await res.json();
    if (!Array.isArray(raw) || raw.length === 0) return [];

    console.log(`[market-data] CoinGecko returned ${raw.length} candles for ${coinId}/${cgDays}d`);

    return raw.map((c) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: 0, // CoinGecko OHLC doesn't include volume
    }));
  } catch (err) {
    console.warn(`[market-data] CoinGecko OHLC failed for ${coinId}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
