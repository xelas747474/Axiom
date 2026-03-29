// ============================================
// Enriched Sentiment Analysis — Fear & Greed + Contrarian Signals
// Cached in Redis (5min TTL)
// ============================================

import { getRedis } from "@/lib/redis";

const CACHE_KEY = "axiom:cache:sentiment";
const CACHE_TTL = 300; // 5 minutes

export interface SentimentData {
  fearGreedValue: number;        // 0-100
  fearGreedClassification: string;
  fearGreedYesterday: number | null;
  fearGreedLastWeek: number | null;
  fearGreedLastMonth: number | null;
  trend: "improving" | "declining" | "stable";
  contrarianSignal: "extreme_fear_buy" | "extreme_greed_sell" | "none";
  divergence: "bullish_divergence" | "bearish_divergence" | "none";
  timestamp: number;
}

async function fetchFearGreedIndex(): Promise<SentimentData> {
  const result: SentimentData = {
    fearGreedValue: 50,
    fearGreedClassification: "Neutral",
    fearGreedYesterday: null,
    fearGreedLastWeek: null,
    fearGreedLastMonth: null,
    trend: "stable",
    contrarianSignal: "none",
    divergence: "none",
    timestamp: Date.now(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://api.alternative.me/fng/?limit=31", {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (!res.ok) return result;

    const json = await res.json();
    const data = json.data;
    if (!Array.isArray(data) || data.length === 0) return result;

    // Today
    result.fearGreedValue = parseInt(data[0].value, 10);
    result.fearGreedClassification = data[0].value_classification ?? "Neutral";

    // Yesterday
    if (data.length > 1) {
      result.fearGreedYesterday = parseInt(data[1].value, 10);
    }

    // Last week (index 7)
    if (data.length > 7) {
      result.fearGreedLastWeek = parseInt(data[7].value, 10);
    }

    // Last month (index 30)
    if (data.length > 30) {
      result.fearGreedLastMonth = parseInt(data[30].value, 10);
    }

    // Trend detection
    if (result.fearGreedYesterday !== null && result.fearGreedLastWeek !== null) {
      const shortTrend = result.fearGreedValue - result.fearGreedYesterday;
      const medTrend = result.fearGreedValue - result.fearGreedLastWeek;
      if (shortTrend > 3 && medTrend > 5) result.trend = "improving";
      else if (shortTrend < -3 && medTrend < -5) result.trend = "declining";
    }

    // Contrarian signals (extreme readings are often reversal indicators)
    if (result.fearGreedValue <= 15) {
      result.contrarianSignal = "extreme_fear_buy"; // Extreme fear = contrarian buy
    } else if (result.fearGreedValue >= 85) {
      result.contrarianSignal = "extreme_greed_sell"; // Extreme greed = contrarian sell
    }

    // Divergence: sentiment moving opposite to price
    // We'll detect this in the scoring function when we have price data

  } catch {
    // Return defaults
  }

  return result;
}

export async function getSentimentData(): Promise<SentimentData> {
  const redis = getRedis();

  // Check cache
  try {
    const cached = await redis.get<SentimentData>(CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached;
    }
  } catch {
    // Cache miss
  }

  const data = await fetchFearGreedIndex();

  // Cache result
  try {
    await redis.set(CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL });
  } catch {
    // Non-critical
  }

  return data;
}

/**
 * Score sentiment from -100 to +100
 * Incorporates contrarian logic: extreme fear = bullish, extreme greed = bearish
 * priceChange7d: optional 7d price change % to detect divergences
 */
export function scoreSentiment(
  data: SentimentData,
  priceChange7d?: number,
): {
  score: number;
  details: string;
  factors: { name: string; score: number; detail: string }[];
} {
  const factors: { name: string; score: number; detail: string }[] = [];

  // Base sentiment score (contrarian approach)
  // Below 25: bullish (market is fearful = buying opportunity)
  // 25-45: slightly bullish
  // 45-55: neutral
  // 55-75: slightly bearish
  // Above 75: bearish (market is greedy = selling opportunity)
  let baseScore = 0;
  const fgv = data.fearGreedValue;
  if (fgv <= 15) baseScore = 70;
  else if (fgv <= 25) baseScore = 50;
  else if (fgv <= 35) baseScore = 25;
  else if (fgv <= 45) baseScore = 10;
  else if (fgv <= 55) baseScore = 0;
  else if (fgv <= 65) baseScore = -10;
  else if (fgv <= 75) baseScore = -25;
  else if (fgv <= 85) baseScore = -50;
  else baseScore = -70;

  factors.push({
    name: "Fear & Greed",
    score: baseScore,
    detail: `${fgv} (${data.fearGreedClassification}) — contrarian`,
  });

  // Trend momentum of sentiment
  let trendScore = 0;
  if (data.trend === "improving") trendScore = 15;
  else if (data.trend === "declining") trendScore = -15;
  factors.push({
    name: "Sentiment Trend",
    score: trendScore,
    detail: data.trend,
  });

  // Contrarian extreme signals (strong conviction)
  let contrarianScore = 0;
  if (data.contrarianSignal === "extreme_fear_buy") contrarianScore = 40;
  else if (data.contrarianSignal === "extreme_greed_sell") contrarianScore = -40;
  if (contrarianScore !== 0) {
    factors.push({
      name: "Contrarian",
      score: contrarianScore,
      detail: data.contrarianSignal,
    });
  }

  // Divergence detection: sentiment vs price
  let divScore = 0;
  if (priceChange7d !== undefined && data.fearGreedLastWeek !== null) {
    const sentimentChange = data.fearGreedValue - data.fearGreedLastWeek;
    // Price up but sentiment declining = bearish divergence
    if (priceChange7d > 3 && sentimentChange < -10) {
      divScore = -30;
      factors.push({
        name: "Divergence",
        score: divScore,
        detail: "Bearish: price up but sentiment declining",
      });
    }
    // Price down but sentiment improving = bullish divergence
    else if (priceChange7d < -3 && sentimentChange > 10) {
      divScore = 30;
      factors.push({
        name: "Divergence",
        score: divScore,
        detail: "Bullish: price down but sentiment improving",
      });
    }
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
