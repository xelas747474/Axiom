// ============================================
// GET /api/market/overview
// Centralized market data for AI Insights page
// Reuses fetchMarketData() + one additional CoinGecko call for heatmap
// ============================================

import { fetchMarketData, FALLBACK_MARKET_DATA, type MarketDataResult } from "@/lib/coingecko";

export const revalidate = 30;

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

// In-memory cache to avoid re-fetching on rate-limit
let overviewCache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 25_000;

async function fetchSafe<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 30 },
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

// Fallback heatmap data when CoinGecko is unavailable
const FALLBACK_HEATMAP = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", price: 67842, change1h: 0.1, change24h: 2.3, change7d: 5.1, marketCap: 1330e9, volume: 28e9, sparkline7d: [] },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", price: 3521, change1h: -0.2, change24h: -0.9, change7d: 3.2, marketCap: 423e9, volume: 15e9, sparkline7d: [] },
  { id: "solana", symbol: "SOL", name: "Solana", price: 178, change1h: 0.5, change24h: 8.6, change7d: 12.3, marketCap: 82e9, volume: 4e9, sparkline7d: [] },
  { id: "binancecoin", symbol: "BNB", name: "BNB", price: 612, change1h: 0.1, change24h: 1.2, change7d: 2.1, marketCap: 92e9, volume: 1.8e9, sparkline7d: [] },
  { id: "ripple", symbol: "XRP", name: "XRP", price: 0.62, change1h: -0.3, change24h: -1.5, change7d: 0.8, marketCap: 34e9, volume: 1.2e9, sparkline7d: [] },
  { id: "cardano", symbol: "ADA", name: "Cardano", price: 0.57, change1h: 0.0, change24h: -3.5, change7d: -2.1, marketCap: 20e9, volume: 0.5e9, sparkline7d: [] },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", price: 42, change1h: 0.8, change24h: 6.2, change7d: 8.4, marketCap: 16e9, volume: 0.8e9, sparkline7d: [] },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", price: 19, change1h: 0.2, change24h: 5.1, change7d: 7.2, marketCap: 11e9, volume: 0.6e9, sparkline7d: [] },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", price: 7.9, change1h: -0.1, change24h: -3.0, change7d: -1.5, marketCap: 10e9, volume: 0.3e9, sparkline7d: [] },
  { id: "matic-network", symbol: "MATIC", name: "Polygon", price: 0.72, change1h: 0.3, change24h: 2.1, change7d: 4.5, marketCap: 7e9, volume: 0.4e9, sparkline7d: [] },
];

export async function GET() {
  // Return cached if fresh
  if (overviewCache && Date.now() - overviewCache.ts < CACHE_TTL) {
    return Response.json(overviewCache.data);
  }

  // Fetch base market data (already has its own cache + fallback)
  let market: MarketDataResult;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  // Fetch heatmap coins + F&G history in parallel (just 2 extra calls)
  const [coinsDetailed, fngHistory] = await Promise.all([
    fetchSafe<CoinMarketData[]>(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${HEATMAP_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`
    ),
    fetchSafe<{ data: FngEntry[] }>(
      "https://api.alternative.me/fng/?limit=30"
    ),
  ]);

  // Process heatmap coins with fallback
  const heatmapCoins = coinsDetailed && coinsDetailed.length > 0
    ? coinsDetailed.map((c) => ({
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
      }))
    : FALLBACK_HEATMAP;

  // Fear & Greed history (30 days) with empty fallback
  const fngHistoryData = (fngHistory?.data ?? []).map((d) => ({
    value: parseInt(d.value, 10),
    timestamp: parseInt(d.timestamp, 10) * 1000,
    classification: d.value_classification,
  }));

  // Compute simplified AI scores for BTC, ETH, SOL
  const mainCryptos = ["bitcoin", "ethereum", "solana"];
  const aiScores = mainCryptos.map((id) => {
    const coin = heatmapCoins.find((c) => c.id === id);
    if (!coin) {
      const sym = id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : "SOL";
      return { id, symbol: sym, name: sym, price: 0, change24h: 0, change7d: 0, sparkline7d: [] as number[], score: 0, categories: getDefaultCategories(), entryPrice: 0, stopLoss: 0, takeProfit: 0 };
    }

    const trend = computeTrendScore(coin);
    const momentum = computeMomentumScore(coin);
    const volume = computeVolumeScore(coin, heatmapCoins);
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

  const result = {
    ...market,
    heatmapCoins,
    fngHistory: fngHistoryData,
    aiScores,
    timestamp: Date.now(),
  };

  // Cache the result
  overviewCache = { data: result, ts: Date.now() };

  return Response.json(result);
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
