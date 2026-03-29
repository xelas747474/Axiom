// ============================================
// GET /api/market/overview
// Centralized market data for AI Insights page
// Uses Redis cache for resilience on Vercel serverless
// ============================================

import { fetchMarketData, FALLBACK_MARKET_DATA, type MarketDataResult } from "@/lib/coingecko";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d?: { price: number[] };
}

interface FngEntry {
  value: string;
  timestamp: string;
  value_classification: string;
}

const REDIS_CACHE_KEY = "axiom:cache:market-overview";
const REDIS_CACHE_TTL = 45; // seconds

async function fetchFresh<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const HEATMAP_IDS = "bitcoin,ethereum,solana,binancecoin,ripple,cardano,avalanche-2,chainlink,polkadot,matic-network";

export async function GET() {
  const redis = getRedis();

  // Try Redis cache first (survives cold starts)
  try {
    const cached = await redis.get<{ data: unknown; ts: number }>(REDIS_CACHE_KEY);
    if (cached && cached.data && Date.now() - cached.ts < REDIS_CACHE_TTL * 1000) {
      return Response.json(cached.data);
    }
  } catch {
    // Redis unavailable, continue to fetch
  }

  // Fetch base market data
  let market: MarketDataResult;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  // Fetch heatmap coins + F&G history in parallel
  const [coinsDetailed, fngHistory] = await Promise.all([
    fetchFresh<CoinMarketData[]>(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${HEATMAP_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`
    ),
    fetchFresh<{ data: FngEntry[] }>(
      "https://api.alternative.me/fng/?limit=30"
    ),
  ]);

  // Process heatmap coins — use live data or try Redis fallback
  let heatmapCoins;
  if (coinsDetailed && coinsDetailed.length > 0) {
    heatmapCoins = coinsDetailed.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change1h: Math.round((c.price_change_percentage_1h_in_currency ?? 0) * 100) / 100,
      change24h: Math.round((c.price_change_percentage_24h ?? 0) * 100) / 100,
      change7d: Math.round((c.price_change_percentage_7d_in_currency ?? 0) * 100) / 100,
      marketCap: c.market_cap,
      volume: c.total_volume,
      sparkline7d: c.sparkline_in_7d?.price ?? [],
    }));
  } else {
    // Try to get last known heatmap from Redis
    try {
      const stale = await redis.get<{ data: { heatmapCoins: typeof heatmapCoins } }>(REDIS_CACHE_KEY);
      heatmapCoins = stale?.data?.heatmapCoins;
    } catch {
      // ignore
    }
    if (!heatmapCoins) {
      // Last resort: use market data prices for BTC/ETH/SOL
      heatmapCoins = buildHeatmapFromMarket(market);
    }
  }

  // Fear & Greed history
  const fngHistoryData = (fngHistory?.data ?? []).map((d) => ({
    value: parseInt(d.value, 10),
    timestamp: parseInt(d.timestamp, 10) * 1000,
    classification: d.value_classification,
  }));

  // Compute AI scores
  const mainCryptos = ["bitcoin", "ethereum", "solana"];
  const aiScores = mainCryptos.map((id) => {
    const coin = heatmapCoins!.find((c: { id: string }) => c.id === id);
    if (!coin) {
      const sym = id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : "SOL";
      return { id, symbol: sym, name: sym, price: 0, change24h: 0, change7d: 0, sparkline7d: [] as number[], score: 0, categories: getDefaultCategories(), entryPrice: 0, stopLoss: 0, takeProfit: 0 };
    }

    const trend = computeTrendScore(coin);
    const momentum = computeMomentumScore(coin);
    const volume = computeVolumeScore(coin, heatmapCoins!);
    const volatility = computeVolatilityScore(coin);
    const sentiment = computeSentimentScore(coin, market.fearGreedIndex);

    const globalScore = Math.round(
      trend.score * 0.30 + momentum.score * 0.25 + volume.score * 0.20 +
      volatility.score * 0.15 + sentiment.score * 0.10
    );

    return {
      id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.price,
      change24h: coin.change24h,
      change7d: coin.change7d,
      sparkline7d: coin.sparkline7d.length > 20 ? sampleArray(coin.sparkline7d, 20) : coin.sparkline7d,
      score: Math.max(-100, Math.min(100, globalScore)),
      categories: [trend, momentum, volume, volatility, sentiment],
      entryPrice: coin.price,
      stopLoss: Math.round(coin.price * 0.97 * 100) / 100,
      takeProfit: Math.round(coin.price * 1.05 * 100) / 100,
    };
  });

  const isLive = coinsDetailed !== null && coinsDetailed.length > 0;

  const result = {
    ...market,
    isLive,
    heatmapCoins,
    fngHistory: fngHistoryData,
    aiScores,
    timestamp: Date.now(),
  };

  // Save to Redis for next cold start
  try {
    await redis.set(REDIS_CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }), { ex: REDIS_CACHE_TTL * 3 });
  } catch {
    // Non-critical
  }

  return Response.json(result);
}

// Build minimal heatmap from market data when CoinGecko coins/markets fails
function buildHeatmapFromMarket(market: MarketDataResult) {
  const allCoins = [...market.topGainers, ...market.topLosers];
  const btc = { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: market.bitcoin.price, change1h: 0, change24h: market.bitcoin.change24h, change7d: 0, marketCap: market.bitcoin.price * 19e6, volume: 30e9, sparkline7d: [] as number[] };
  const eth = { id: "ethereum", symbol: "ETH", name: "Ethereum", price: market.ethereum.price, change1h: 0, change24h: market.ethereum.change24h, change7d: 0, marketCap: market.ethereum.price * 120e6, volume: 15e9, sparkline7d: [] as number[] };
  const sol = allCoins.find(c => c.symbol === "SOL");
  const solEntry = { id: "solana", symbol: "SOL", name: "Solana", price: sol?.price ?? 0, change1h: 0, change24h: sol?.change24h ?? 0, change7d: 0, marketCap: (sol?.price ?? 0) * 440e6, volume: 4e9, sparkline7d: [] as number[] };

  const extras = allCoins
    .filter(c => !["BTC", "ETH", "SOL"].includes(c.symbol))
    .slice(0, 7)
    .map(c => ({
      id: c.name.toLowerCase().replace(/\s/g, "-"),
      symbol: c.symbol,
      name: c.name,
      price: c.price,
      change1h: 0,
      change24h: c.change24h,
      change7d: 0,
      marketCap: c.price * 100e6,
      volume: 1e9,
      sparkline7d: [] as number[],
    }));

  return [btc, eth, solEntry, ...extras];
}

function sampleArray(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const step = (arr.length - 1) / (n - 1);
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

interface CategoryResult {
  category: string;
  score: number;
  details: string;
}

function getDefaultCategories(): CategoryResult[] {
  return [
    { category: "Tendance", score: 0, details: "Données insuffisantes" },
    { category: "Momentum", score: 0, details: "Données insuffisantes" },
    { category: "Volume", score: 0, details: "Données insuffisantes" },
    { category: "Volatilité", score: 0, details: "Données insuffisantes" },
    { category: "Sentiment", score: 0, details: "Données insuffisantes" },
  ];
}

function computeTrendScore(coin: { change1h: number; change24h: number; change7d: number; sparkline7d: number[] }): CategoryResult {
  let score = 0;
  if (coin.change1h > 1) score += 20; else if (coin.change1h > 0) score += 10; else if (coin.change1h > -1) score -= 10; else score -= 20;
  if (coin.change24h > 3) score += 30; else if (coin.change24h > 0) score += 15; else if (coin.change24h > -3) score -= 15; else score -= 30;
  if (coin.change7d > 5) score += 25; else if (coin.change7d > 0) score += 10; else if (coin.change7d > -5) score -= 10; else score -= 25;
  if (coin.sparkline7d.length > 20) {
    const recent = coin.sparkline7d.slice(-10);
    const older = coin.sparkline7d.slice(-20, -10);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    if (recentAvg > olderAvg * 1.02) score += 25;
    else if (recentAvg > olderAvg) score += 10;
    else if (recentAvg < olderAvg * 0.98) score -= 25;
    else score -= 10;
  }
  const clamped = Math.max(-100, Math.min(100, score));
  return { category: "Tendance", score: clamped, details: clamped > 20 ? "Tendance haussière" : clamped < -20 ? "Tendance baissière" : "Tendance neutre" };
}

function computeMomentumScore(coin: { change1h: number; change24h: number; change7d: number; sparkline7d: number[] }): CategoryResult {
  let score = 0;
  if (coin.sparkline7d.length > 14) {
    const changes: number[] = [];
    for (let i = 1; i < coin.sparkline7d.length; i++) changes.push(coin.sparkline7d[i] - coin.sparkline7d[i - 1]);
    const recent = changes.slice(-14);
    const gains = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14;
    const losses = Math.abs(recent.filter(c => c < 0).reduce((a, b) => a + b, 0)) / 14;
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));
    if (rsi > 70) score -= 30; else if (rsi > 50) score += 20; else if (rsi > 30) score -= 10; else score += 30;
  }
  const roc24h = coin.change24h;
  if (roc24h > 5) score += 30; else if (roc24h > 2) score += 20; else if (roc24h > 0) score += 5;
  else if (roc24h > -2) score -= 5; else if (roc24h > -5) score -= 20; else score -= 30;
  if (coin.change1h > 0 && coin.change24h > 0) score += 15;
  else if (coin.change1h < 0 && coin.change24h < 0) score -= 15;
  const clamped = Math.max(-100, Math.min(100, score));
  return { category: "Momentum", score: clamped, details: clamped > 20 ? "Momentum haussier" : clamped < -20 ? "Momentum baissier" : "Momentum neutre" };
}

function computeVolumeScore(coin: { volume: number; marketCap: number }, allCoins: Array<{ volume: number; marketCap: number }>): CategoryResult {
  const ratio = coin.marketCap > 0 ? coin.volume / coin.marketCap : 0;
  const avgRatio = allCoins.reduce((a, c) => a + (c.marketCap > 0 ? c.volume / c.marketCap : 0), 0) / allCoins.length;
  let score = 0;
  if (ratio > avgRatio * 2) score = 60; else if (ratio > avgRatio * 1.5) score = 40; else if (ratio > avgRatio) score = 20; else if (ratio > avgRatio * 0.5) score = -10; else score = -30;
  const clamped = Math.max(-100, Math.min(100, score));
  const mult = avgRatio > 0 ? (ratio / avgRatio).toFixed(1) : "1.0";
  return { category: "Volume", score: clamped, details: `Volume ${mult}x vs moyenne` };
}

function computeVolatilityScore(coin: { sparkline7d: number[]; change24h: number }): CategoryResult {
  let score = 0;
  if (coin.sparkline7d.length > 10) {
    const returns: number[] = [];
    for (let i = 1; i < coin.sparkline7d.length; i++) returns.push((coin.sparkline7d[i] - coin.sparkline7d[i - 1]) / coin.sparkline7d[i - 1]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;
    if (volatility < 1) score = 20; else if (volatility < 2) score = 10; else if (volatility < 4) score = -10; else score = -30;
  }
  const clamped = Math.max(-100, Math.min(100, score));
  return { category: "Volatilité", score: clamped, details: clamped > 0 ? "Volatilité contenue" : "Volatilité élevée" };
}

function computeSentimentScore(coin: { change24h: number; change7d: number }, fgi: number): CategoryResult {
  let score = 0;
  if (fgi >= 75) score -= 20; else if (fgi >= 55) score += 15; else if (fgi >= 40) score += 5; else if (fgi >= 25) score += 20; else score += 30;
  if (coin.change24h > 3) score += 15; else if (coin.change24h > 0) score += 5; else if (coin.change24h > -3) score -= 5; else score -= 15;
  if (coin.change7d > 5) score += 10; else if (coin.change7d < -5) score -= 10;
  const clamped = Math.max(-100, Math.min(100, score));
  return { category: "Sentiment", score: clamped, details: clamped > 15 ? "Sentiment favorable" : clamped < -15 ? "Sentiment négatif" : "Sentiment neutre" };
}
