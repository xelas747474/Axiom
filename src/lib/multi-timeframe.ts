// ============================================
// Multi-Timeframe Analysis — 1D / 7D / 30D alignment
// Primary: Binance OHLCV | Fallback: CoinGecko OHLC
// Cached in Redis (5min TTL)
// ============================================

import { getRedis } from "@/lib/redis";
import { getBinanceOHLCV, COINGECKO_TO_SYMBOL } from "@/lib/binance";

const CACHE_KEY_PREFIX = "axiom:cache:mtf";
const CACHE_TTL = 300;

export interface TimeframeSignal {
  period: "1D" | "7D" | "30D";
  trend: "bullish" | "bearish" | "neutral";
  strength: number;
  rsi: number | null;
  priceChange: number;
  detail: string;
}

export interface MultiTimeframeData {
  coinId: string;
  timeframes: TimeframeSignal[];
  alignment: "aligned_bullish" | "aligned_bearish" | "mixed" | "neutral";
  alignmentStrength: number;
  timestamp: number;
}

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function analyzeTrend(closes: number[]): { trend: "bullish" | "bearish" | "neutral"; strength: number } {
  if (closes.length < 3) return { trend: "neutral", strength: 0 };

  const first = closes[0];
  const last = closes[closes.length - 1];
  const mid = closes[Math.floor(closes.length / 2)];
  const change = ((last - first) / first) * 100;
  const isUp = last > first;

  let consistentMoves = 0;
  for (let i = 1; i < closes.length; i++) {
    if ((closes[i] > closes[i - 1]) === isUp) consistentMoves++;
  }
  const consistency = consistentMoves / (closes.length - 1);

  const shortLen = Math.min(5, Math.floor(closes.length / 3));
  const longLen = Math.min(20, closes.length);
  const shortSMA = closes.slice(-shortLen).reduce((a, b) => a + b, 0) / shortLen;
  const longSMA = closes.slice(-longLen).reduce((a, b) => a + b, 0) / longLen;
  const smaAligned = isUp ? shortSMA > longSMA : shortSMA < longSMA;

  let strength = Math.min(100, Math.abs(change) * 10);
  if (consistency > 0.6) strength = Math.min(100, strength * 1.3);
  if (smaAligned) strength = Math.min(100, strength * 1.2);

  const midAligned = isUp ? (mid > first && last > mid) : (mid < first && last < mid);
  if (!midAligned) strength *= 0.7;

  if (Math.abs(change) < 0.5) return { trend: "neutral", strength: Math.round(strength) };
  return {
    trend: change > 0 ? "bullish" : "bearish",
    strength: Math.round(strength),
  };
}

// Fetch OHLCV via Binance (primary) or CoinGecko (fallback)
async function fetchOHLCData(coinId: string, days: number): Promise<number[]> {
  // Convert CoinGecko ID → AXIOM symbol for Binance
  const symbol = COINGECKO_TO_SYMBOL[coinId];

  if (symbol) {
    // Use Binance — much faster, no rate limit issues
    const interval = days <= 1 ? "1h" as const : days <= 7 ? "4h" as const : "1d" as const;
    const limit = days <= 1 ? 24 : days <= 7 ? 42 : 30;
    const candles = await getBinanceOHLCV(symbol, interval, limit);
    if (candles && candles.length > 3) {
      return candles.map(c => c.close);
    }
  }

  // Fallback: CoinGecko OHLC
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`,
      { signal: controller.signal, cache: "no-store" }
    );
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const ohlc: number[][] = await res.json();
    return ohlc.map(c => c[4]); // close price
  } catch {
    return [];
  }
}

async function analyzeTimeframe(
  coinId: string,
  period: "1D" | "7D" | "30D",
  days: number,
): Promise<TimeframeSignal> {
  const closes = await fetchOHLCData(coinId, days);

  if (closes.length < 3) {
    return { period, trend: "neutral", strength: 0, rsi: null, priceChange: 0, detail: "Données insuffisantes" };
  }

  const first = closes[0];
  const last = closes[closes.length - 1];
  const priceChange = ((last - first) / first) * 100;
  const rsi = computeRSI(closes);
  const { trend, strength } = analyzeTrend(closes);

  let detail = `${period}: ${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`;
  if (rsi !== null) detail += ` | RSI: ${rsi.toFixed(0)}`;
  detail += ` | ${trend} (${strength}%)`;

  return { period, trend, strength, rsi, priceChange, detail };
}

export async function getMultiTimeframeData(coinId: string): Promise<MultiTimeframeData> {
  const redis = getRedis();
  const cacheKey = `${CACHE_KEY_PREFIX}:${coinId}`;

  try {
    const cached = await redis.get<MultiTimeframeData>(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached;
    }
  } catch { /* cache miss */ }

  // Fetch all timeframes — Binance is fast enough for parallel
  const [tf1d, tf7d, tf30d] = await Promise.all([
    analyzeTimeframe(coinId, "1D", 1),
    analyzeTimeframe(coinId, "7D", 7),
    analyzeTimeframe(coinId, "30D", 30),
  ]);

  const timeframes = [tf1d, tf7d, tf30d];

  const bullish = timeframes.filter(tf => tf.trend === "bullish").length;
  const bearish = timeframes.filter(tf => tf.trend === "bearish").length;

  let alignment: MultiTimeframeData["alignment"];
  let alignmentStrength: number;

  if (bullish === 3) {
    alignment = "aligned_bullish";
    alignmentStrength = Math.round(timeframes.reduce((s, tf) => s + tf.strength, 0) / 3);
  } else if (bearish === 3) {
    alignment = "aligned_bearish";
    alignmentStrength = Math.round(timeframes.reduce((s, tf) => s + tf.strength, 0) / 3);
  } else if (bullish === 0 && bearish === 0) {
    alignment = "neutral";
    alignmentStrength = 0;
  } else {
    alignment = "mixed";
    alignmentStrength = Math.round(Math.abs(bullish - bearish) * 33);
  }

  const data: MultiTimeframeData = {
    coinId, timeframes, alignment, alignmentStrength, timestamp: Date.now(),
  };

  try {
    await redis.set(cacheKey, data, { ex: CACHE_TTL });
  } catch { /* non-critical */ }

  return data;
}

/**
 * Score multi-timeframe alignment from -100 to +100
 */
export function scoreMultiTimeframe(data: MultiTimeframeData): {
  score: number;
  details: string;
  factors: { name: string; score: number; detail: string }[];
} {
  const factors: { name: string; score: number; detail: string }[] = [];

  for (const tf of data.timeframes) {
    let s = 0;
    if (tf.trend === "bullish") s = Math.round(tf.strength * 0.6);
    else if (tf.trend === "bearish") s = -Math.round(tf.strength * 0.6);

    if (tf.rsi !== null) {
      if (tf.rsi < 30) s += 20;
      else if (tf.rsi > 70) s -= 20;
    }

    factors.push({
      name: tf.period,
      score: Math.max(-100, Math.min(100, s)),
      detail: tf.detail,
    });
  }

  let alignmentBonus = 0;
  if (data.alignment === "aligned_bullish") alignmentBonus = 25;
  else if (data.alignment === "aligned_bearish") alignmentBonus = -25;

  if (alignmentBonus !== 0) {
    factors.push({
      name: "Alignment",
      score: alignmentBonus,
      detail: `${data.alignment} (${data.alignmentStrength}%)`,
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
