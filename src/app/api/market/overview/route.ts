// ============================================
// GET /api/market/overview
// Centralized market data for AI Insights page
// Combines CoinGecko data + Fear & Greed + simplified AI scores
// ============================================

import { fetchMarketData, FALLBACK_MARKET_DATA, type MarketDataResult } from "@/lib/coingecko";

export const revalidate = 30;

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const FETCH_TIMEOUT = 6000;

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

async function fetchSafe<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
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

export async function GET() {
  let market: MarketDataResult;
  try {
    market = await fetchMarketData();
  } catch {
    market = FALLBACK_MARKET_DATA;
  }

  // Fetch detailed coin data for heatmap + scores (with sparkline for 7d correlation)
  const [coinsDetailed, fngHistory] = await Promise.all([
    fetchSafe<CoinMarketData[]>(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${HEATMAP_IDS}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`
    ),
    fetchSafe<{ data: Array<{ value: string; timestamp: string; value_classification: string }> }>(
      "https://api.alternative.me/fng/?limit=30"
    ),
  ]);

  // Process heatmap coins
  const heatmapCoins = (coinsDetailed ?? []).map((c) => ({
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

  // Fear & Greed history (30 days)
  const fngHistoryData = (fngHistory?.data ?? []).map((d) => ({
    value: parseInt(d.value, 10),
    timestamp: parseInt(d.timestamp, 10) * 1000,
    classification: d.value_classification,
  }));

  // Compute simplified AI scores for BTC, ETH, SOL from available data
  const mainCryptos = ["bitcoin", "ethereum", "solana"];
  const aiScores = mainCryptos.map((id) => {
    const coin = heatmapCoins.find((c) => c.id === id);
    if (!coin) return { id, symbol: id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : "SOL", score: 0, categories: getDefaultCategories() };

    // Simplified scoring from price action data
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

  return Response.json({
    ...market,
    heatmapCoins,
    fngHistory: fngHistoryData,
    aiScores,
    timestamp: Date.now(),
  });
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
  // Short-term trend from 1h and 24h changes
  if (coin.change1h > 1) score += 20; else if (coin.change1h > 0) score += 10; else if (coin.change1h > -1) score -= 10; else score -= 20;
  if (coin.change24h > 3) score += 30; else if (coin.change24h > 0) score += 15; else if (coin.change24h > -3) score -= 15; else score -= 30;
  if (coin.change7d > 5) score += 25; else if (coin.change7d > 0) score += 10; else if (coin.change7d > -5) score -= 10; else score -= 25;

  // SMA trend from sparkline
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
  const details = clamped > 20 ? "Tendance haussière" : clamped < -20 ? "Tendance baissière" : "Tendance neutre";
  return { category: "Tendance", score: clamped, details };
}

function computeMomentumScore(coin: { change1h: number; change24h: number; change7d: number; sparkline7d: number[] }): CategoryResult {
  let score = 0;

  // Estimate RSI from price action
  if (coin.sparkline7d.length > 14) {
    const changes: number[] = [];
    for (let i = 1; i < coin.sparkline7d.length; i++) {
      changes.push(coin.sparkline7d[i] - coin.sparkline7d[i - 1]);
    }
    const recent = changes.slice(-14);
    const gains = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / 14;
    const losses = Math.abs(recent.filter(c => c < 0).reduce((a, b) => a + b, 0)) / 14;
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    if (rsi > 70) score -= 30; // Overbought
    else if (rsi > 50) score += 20;
    else if (rsi > 30) score -= 10;
    else score += 30; // Oversold = buy opportunity
  }

  // Momentum from rate of change
  const roc24h = coin.change24h;
  if (roc24h > 5) score += 30; else if (roc24h > 2) score += 20; else if (roc24h > 0) score += 5;
  else if (roc24h > -2) score -= 5; else if (roc24h > -5) score -= 20; else score -= 30;

  // Acceleration
  if (coin.change1h > 0 && coin.change24h > 0) score += 15;
  else if (coin.change1h < 0 && coin.change24h < 0) score -= 15;

  const clamped = Math.max(-100, Math.min(100, score));
  const details = clamped > 20 ? "Momentum haussier" : clamped < -20 ? "Momentum baissier" : "Momentum neutre";
  return { category: "Momentum", score: clamped, details };
}

function computeVolumeScore(coin: { volume: number; marketCap: number }, allCoins: Array<{ volume: number; marketCap: number }>): CategoryResult {
  // Volume to market cap ratio
  const ratio = coin.marketCap > 0 ? coin.volume / coin.marketCap : 0;
  const avgRatio = allCoins.reduce((a, c) => a + (c.marketCap > 0 ? c.volume / c.marketCap : 0), 0) / allCoins.length;

  let score = 0;
  if (ratio > avgRatio * 2) score = 60;
  else if (ratio > avgRatio * 1.5) score = 40;
  else if (ratio > avgRatio) score = 20;
  else if (ratio > avgRatio * 0.5) score = -10;
  else score = -30;

  const clamped = Math.max(-100, Math.min(100, score));
  const mult = avgRatio > 0 ? (ratio / avgRatio).toFixed(1) : "1.0";
  const details = `Volume ${mult}x vs moyenne`;
  return { category: "Volume", score: clamped, details };
}

function computeVolatilityScore(coin: { sparkline7d: number[]; change24h: number }): CategoryResult {
  let score = 0;

  if (coin.sparkline7d.length > 10) {
    const returns: number[] = [];
    for (let i = 1; i < coin.sparkline7d.length; i++) {
      returns.push((coin.sparkline7d[i] - coin.sparkline7d[i - 1]) / coin.sparkline7d[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100;

    // Low volatility favors consolidation (slightly positive), high volatility = risk
    if (volatility < 1) score = 20;
    else if (volatility < 2) score = 10;
    else if (volatility < 4) score = -10;
    else score = -30;
  }

  const clamped = Math.max(-100, Math.min(100, score));
  const details = clamped > 0 ? "Volatilité contenue" : "Volatilité élevée";
  return { category: "Volatilité", score: clamped, details };
}

function computeSentimentScore(coin: { change24h: number; change7d: number }, fgi: number): CategoryResult {
  let score = 0;

  // Fear & Greed contribution
  if (fgi >= 75) score -= 20; // Too greedy = risky
  else if (fgi >= 55) score += 15;
  else if (fgi >= 40) score += 5;
  else if (fgi >= 25) score += 20; // Fear = opportunity
  else score += 30; // Extreme fear = strong buy signal

  // Price action sentiment
  if (coin.change24h > 3) score += 15;
  else if (coin.change24h > 0) score += 5;
  else if (coin.change24h > -3) score -= 5;
  else score -= 15;

  if (coin.change7d > 5) score += 10;
  else if (coin.change7d < -5) score -= 10;

  const clamped = Math.max(-100, Math.min(100, score));
  const details = clamped > 15 ? "Sentiment favorable" : clamped < -15 ? "Sentiment négatif" : "Sentiment neutre";
  return { category: "Sentiment", score: clamped, details };
}
