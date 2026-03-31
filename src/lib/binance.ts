// ============================================
// Binance Public API Client — FREE, no API key required
// Primary data source for AXIOM (faster + no rate limit issues)
// Preserves original fetchOHLCV / fetchCurrentPrice exports for trading page
// ============================================

import { type OHLCV, type CryptoSymbol, TIMEFRAMES, type TimeframeLabel } from "./indicators/types";

const BASE_URL = "https://api.binance.com/api/v3";

// ============================================
// SYMBOL MAPS
// ============================================

/** AXIOM short symbol → Binance trading pair */
export const SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  DOT: "DOTUSDT",
  MATIC: "MATICUSDT",
};

/** AXIOM symbol → CoinGecko ID (for fallback only) */
export const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  DOT: "polkadot",
  MATIC: "matic-network",
};

/** CoinGecko ID → AXIOM symbol */
export const COINGECKO_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym])
);

// ============================================
// TYPES
// ============================================

export interface TickerData {
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type BinanceInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

// ============================================
// SINGLE PRICE
// ============================================

export async function getBinancePrice(
  symbol: string
): Promise<{ price: number; change24h: number } | null> {
  try {
    const ticker = SYMBOLS[symbol];
    if (!ticker) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${BASE_URL}/ticker/24hr?symbol=${ticker}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      change24h: parseFloat(data.priceChangePercent),
    };
  } catch {
    return null;
  }
}

// ============================================
// ALL PRICES — single HTTP call for all tickers
// ============================================

export async function getAllBinancePrices(): Promise<Record<string, TickerData>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${BASE_URL}/ticker/24hr`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Binance ticker error");

    const allTickers: Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      quoteVolume: string;
      highPrice: string;
      lowPrice: string;
    }> = await res.json();

    const result: Record<string, TickerData> = {};

    for (const [sym, pair] of Object.entries(SYMBOLS)) {
      const data = allTickers.find((t) => t.symbol === pair);
      if (data) {
        result[sym] = {
          price: parseFloat(data.lastPrice),
          change24h: parseFloat(data.priceChangePercent),
          volume24h: parseFloat(data.quoteVolume),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
        };
      }
    }

    return result;
  } catch {
    return {};
  }
}

// ============================================
// OHLCV (klines) — up to 1000 candles per call
// ============================================

export async function getBinanceOHLCV(
  symbol: string,
  interval: BinanceInterval = "1h",
  limit: number = 500
): Promise<OHLCVCandle[] | null> {
  try {
    const ticker = SYMBOLS[symbol];
    if (!ticker) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${BASE_URL}/klines?symbol=${ticker}&interval=${interval}&limit=${Math.min(limit, 1000)}`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data: unknown[][] = await res.json();
    return data.map((c) => ({
      timestamp: c[0] as number,
      open: parseFloat(c[1] as string),
      high: parseFloat(c[2] as string),
      low: parseFloat(c[3] as string),
      close: parseFloat(c[4] as string),
      volume: parseFloat(c[5] as string),
    }));
  } catch {
    return null;
  }
}

// ============================================
// HISTORICAL OHLCV — paginated for long backtests
// Binance returns max 1000 per call, so we paginate backwards
// ============================================

export async function getBinanceHistoricalOHLCV(
  symbol: string,
  interval: "1h" | "4h" | "1d",
  days: number
): Promise<OHLCVCandle[]> {
  const ticker = SYMBOLS[symbol];
  if (!ticker) return [];

  const intervalMs =
    interval === "1h" ? 3_600_000 : interval === "4h" ? 14_400_000 : 86_400_000;
  const totalCandles = Math.ceil((days * 86_400_000) / intervalMs);
  const batchSize = 1000;

  const allCandles: OHLCVCandle[] = [];
  let endTime = Date.now();
  let remaining = totalCandles;

  while (remaining > 0) {
    const limit = Math.min(batchSize, remaining);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `${BASE_URL}/klines?symbol=${ticker}&interval=${interval}&limit=${limit}&endTime=${endTime}`,
        { signal: controller.signal, cache: "no-store" }
      );
      clearTimeout(timeoutId);
      if (!res.ok) break;

      const data: unknown[][] = await res.json();
      if (data.length === 0) break;

      const candles = data.map((c) => ({
        timestamp: c[0] as number,
        open: parseFloat(c[1] as string),
        high: parseFloat(c[2] as string),
        low: parseFloat(c[3] as string),
        close: parseFloat(c[4] as string),
        volume: parseFloat(c[5] as string),
      }));

      allCandles.unshift(...candles);
      endTime = (data[0][0] as number) - 1;
      remaining -= data.length;

      // Polite delay between paginated calls
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    } catch {
      break;
    }
  }

  return allCandles;
}

// ============================================
// LEGACY EXPORTS — used by trading page charts
// Preserved for backward compatibility
// ============================================

const OHLCV_CACHE_TTL = 55_000;
interface CacheEntry {
  data: OHLCV[];
  timestamp: number;
}
const ohlcvCache = new Map<string, CacheEntry>();

/** Original fetchOHLCV for trading page — returns OHLCV[] with `time` field */
export async function fetchOHLCV(
  symbol: CryptoSymbol,
  timeframeLabel: TimeframeLabel,
  limit = 200
): Promise<OHLCV[]> {
  const tf = TIMEFRAMES.find((t) => t.label === timeframeLabel);
  if (!tf) throw new Error(`Unknown timeframe: ${timeframeLabel}`);

  const cacheKey = `${symbol}_${tf.interval}`;
  const cached = ohlcvCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < OHLCV_CACHE_TTL) {
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
      if (cached) return cached.data;
      throw new Error(`Binance API error: ${res.status}`);
    }

    const raw: unknown[][] = await res.json();
    const data: OHLCV[] = raw.map((k) => ({
      time: Math.floor((k[0] as number) / 1000),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    ohlcvCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

/** Original fetchCurrentPrice for trading page */
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
