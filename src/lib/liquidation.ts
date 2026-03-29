// ============================================
// Liquidation Levels — Funding Rate, Long/Short Ratio
// Uses Binance public futures API (no key required)
// Cached in Redis (5min TTL)
// ============================================

import { getRedis } from "@/lib/redis";

const CACHE_KEY_PREFIX = "axiom:cache:liq";
const CACHE_TTL = 300; // 5 minutes

export interface LiquidationData {
  symbol: string;
  fundingRate: number | null;       // Current funding rate (e.g., 0.0001 = 0.01%)
  fundingRateAnnualized: number | null;
  longShortRatio: number | null;    // >1 = more longs, <1 = more shorts
  openInterest: number | null;      // Total open interest in USDT
  openInterestChange24h: number | null;
  estimatedLiqLevels: {
    longLiqZone: number | null;     // Price where mass long liquidations would trigger
    shortLiqZone: number | null;    // Price where mass short liquidations would trigger
  };
  timestamp: number;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchFundingRate(symbol: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return parseFloat(data[0].fundingRate);
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchLongShortRatio(symbol: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return parseFloat(data[0].longShortRatio);
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchOpenInterest(symbol: string): Promise<{ oi: number | null; change24h: number | null }> {
  try {
    const res = await fetchWithTimeout(
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`
    );
    if (!res.ok) return { oi: null, change24h: null };
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const latest = parseFloat(data[data.length - 1].sumOpenInterestValue);
      const oldest = data.length > 23 ? parseFloat(data[0].sumOpenInterestValue) : null;
      const change = oldest && oldest > 0 ? ((latest - oldest) / oldest) * 100 : null;
      return { oi: latest, change24h: change };
    }
  } catch { /* ignore */ }
  return { oi: null, change24h: null };
}

function estimateLiquidationZones(
  currentPrice: number,
  fundingRate: number | null,
  longShortRatio: number | null,
): { longLiqZone: number | null; shortLiqZone: number | null } {
  // Estimate liquidation zones based on typical leverage patterns
  // Most retail uses 5-20x leverage, so liquidation is 5-20% away from entry
  // Cluster entries near current price with heavier weighting at popular leverage levels

  // Typical liquidation distances by leverage:
  // 5x = 20%, 10x = 10%, 20x = 5%, 50x = 2%, 100x = 1%
  // Most volume is at 10-20x, so main liquidation zone is 5-10% away

  const avgLiqDistance = 0.07; // 7% average distance
  const longLiqZone = currentPrice * (1 - avgLiqDistance);
  const shortLiqZone = currentPrice * (1 + avgLiqDistance);

  // Adjust based on funding rate (high positive = more longs, liq zone is closer below)
  // Adjust based on L/S ratio
  let longAdj = 1.0;
  let shortAdj = 1.0;

  if (fundingRate !== null) {
    // High positive funding = crowded long, liquidation zone is a bigger target
    if (fundingRate > 0.001) { longAdj = 0.92; shortAdj = 1.05; }
    else if (fundingRate < -0.001) { longAdj = 1.05; shortAdj = 0.92; }
  }

  if (longShortRatio !== null) {
    if (longShortRatio > 1.5) { longAdj *= 0.95; } // More longs = more liq risk below
    else if (longShortRatio < 0.7) { shortAdj *= 0.95; }
  }

  return {
    longLiqZone: Math.round(currentPrice * (1 - avgLiqDistance * longAdj) * 100) / 100,
    shortLiqZone: Math.round(currentPrice * (1 + avgLiqDistance * shortAdj) * 100) / 100,
  };
}

export async function getLiquidationData(symbol: string, currentPrice: number): Promise<LiquidationData> {
  const redis = getRedis();
  const cacheKey = `${CACHE_KEY_PREFIX}:${symbol}`;

  // Check cache
  try {
    const cached = await redis.get<LiquidationData>(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached;
    }
  } catch { /* cache miss */ }

  // Fetch all data in parallel
  const [fundingRate, longShortRatio, oi] = await Promise.all([
    fetchFundingRate(symbol),
    fetchLongShortRatio(symbol),
    fetchOpenInterest(symbol),
  ]);

  const liqZones = estimateLiquidationZones(currentPrice, fundingRate, longShortRatio);

  const data: LiquidationData = {
    symbol,
    fundingRate,
    fundingRateAnnualized: fundingRate !== null ? fundingRate * 3 * 365 * 100 : null, // 3 funding periods/day
    longShortRatio,
    openInterest: oi.oi,
    openInterestChange24h: oi.change24h,
    estimatedLiqLevels: liqZones,
    timestamp: Date.now(),
  };

  // Cache
  try {
    await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL });
  } catch { /* non-critical */ }

  return data;
}

/**
 * Score liquidation data from -100 to +100
 * Positive = bullish positioning, Negative = bearish positioning
 */
export function scoreLiquidation(data: LiquidationData): {
  score: number;
  details: string;
  factors: { name: string; score: number; detail: string }[];
} {
  const factors: { name: string; score: number; detail: string }[] = [];

  // Funding rate analysis
  // High positive = crowded long = risk of squeeze down (bearish)
  // High negative = crowded short = risk of squeeze up (bullish)
  if (data.fundingRate !== null) {
    let s = 0;
    const fr = data.fundingRate;
    if (fr > 0.001) s = -50;       // Very high funding = bearish (crowded long)
    else if (fr > 0.0005) s = -25;
    else if (fr > 0.0001) s = -10;
    else if (fr > -0.0001) s = 0;
    else if (fr > -0.0005) s = 10;
    else if (fr > -0.001) s = 25;
    else s = 50;                    // Very negative funding = bullish (crowded short)
    factors.push({
      name: "Funding Rate",
      score: s,
      detail: `${(fr * 100).toFixed(4)}% (${data.fundingRateAnnualized?.toFixed(1)}% ann.)`,
    });
  }

  // Long/Short ratio
  if (data.longShortRatio !== null) {
    let s = 0;
    const lsr = data.longShortRatio;
    // Contrarian: too many longs = bearish, too many shorts = bullish
    if (lsr > 2.0) s = -40;
    else if (lsr > 1.3) s = -20;
    else if (lsr > 0.8) s = 0;
    else if (lsr > 0.5) s = 20;
    else s = 40;
    factors.push({
      name: "Long/Short Ratio",
      score: s,
      detail: `${lsr.toFixed(2)} — ${lsr > 1 ? "long-heavy" : "short-heavy"}`,
    });
  }

  // Open interest trend
  if (data.openInterestChange24h !== null) {
    let s = 0;
    const oiChange = data.openInterestChange24h;
    // Rising OI = new money entering = trend continuation
    // Falling OI = positions closing = potential reversal
    if (oiChange > 10) s = 15;
    else if (oiChange > 3) s = 8;
    else if (oiChange < -10) s = -15;
    else if (oiChange < -3) s = -8;
    factors.push({
      name: "Open Interest",
      score: s,
      detail: `${oiChange.toFixed(1)}% 24h change`,
    });
  }

  const total = factors.reduce((s, f) => s + f.score, 0);
  const avg = Math.round(total / Math.max(factors.length, 1));
  const clamped = Math.max(-100, Math.min(100, avg));

  return {
    score: clamped,
    details: factors.map(f => `${f.name}: ${f.detail} (${f.score > 0 ? "+" : ""}${f.score})`).join(" | "),
    factors,
  };
}
