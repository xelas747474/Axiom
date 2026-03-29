// ============================================
// On-Chain Data — Blockchain.info + estimation for exchange flows
// Cached in Redis (5min TTL) to stay under Vercel 10s timeout
// ============================================

import { getRedis } from "@/lib/redis";

const CACHE_KEY = "axiom:cache:onchain";
const CACHE_TTL = 300; // 5 minutes

export interface OnChainData {
  hashRate: number | null;         // TH/s
  hashRateChange7d: number | null; // % change
  txVolume24h: number | null;      // BTC
  mempoolSize: number | null;      // unconfirmed tx count
  mempoolGrowthRate: number;       // positive = growing, negative = clearing
  exchangeFlowEstimate: "inflow" | "outflow" | "neutral";
  activeAddresses24h: number | null;
  difficulty: number | null;
  blockHeight: number | null;
  timestamp: number;
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchBlockchainInfo(): Promise<Partial<OnChainData>> {
  const result: Partial<OnChainData> = {};

  try {
    // Fetch stats (hashrate, difficulty, etc.)
    const statsRes = await fetchWithTimeout("https://api.blockchain.info/stats?format=json");
    if (statsRes.ok) {
      const stats = await statsRes.json();
      result.hashRate = stats.hash_rate ?? null;
      result.difficulty = stats.difficulty ?? null;
      result.blockHeight = stats.n_blocks_total ?? null;
      result.txVolume24h = stats.estimated_btc_sent
        ? stats.estimated_btc_sent / 1e8
        : null;
    }
  } catch {
    // Non-critical, continue
  }

  try {
    // Mempool unconfirmed tx count
    const mempoolRes = await fetchWithTimeout("https://api.blockchain.info/q/unconfirmedcount");
    if (mempoolRes.ok) {
      const text = await mempoolRes.text();
      result.mempoolSize = parseInt(text, 10) || null;
    }
  } catch {
    // Non-critical
  }

  try {
    // Hash rate from 7 days ago for comparison
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 86400;
    const hrRes = await fetchWithTimeout(
      `https://api.blockchain.info/charts/hash-rate?timespan=8days&format=json&start=${weekAgo}`
    );
    if (hrRes.ok) {
      const data = await hrRes.json();
      const values = data.values ?? [];
      if (values.length >= 2 && result.hashRate) {
        const oldRate = values[0].y;
        if (oldRate > 0) {
          result.hashRateChange7d = ((result.hashRate - oldRate) / oldRate) * 100;
        }
      }
    }
  } catch {
    // Non-critical
  }

  return result;
}

function estimateExchangeFlow(
  txVolume: number | null,
  mempoolSize: number | null,
): "inflow" | "outflow" | "neutral" {
  // Heuristic: large mempool + high tx volume suggests exchange activity
  // This is a rough estimate since we don't have direct exchange flow data
  if (!txVolume || !mempoolSize) return "neutral";

  // High mempool (>50k unconfirmed) with high volume suggests selling pressure (inflow to exchanges)
  if (mempoolSize > 50000 && txVolume > 300000) return "inflow";
  // Low mempool with moderate volume suggests accumulation (outflow from exchanges)
  if (mempoolSize < 20000 && txVolume > 100000) return "outflow";
  return "neutral";
}

export async function getOnChainData(): Promise<OnChainData> {
  const redis = getRedis();

  // Check cache
  try {
    const cached = await redis.get<OnChainData>(CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return cached;
    }
  } catch {
    // Cache miss, continue to fetch
  }

  const raw = await fetchBlockchainInfo();

  const data: OnChainData = {
    hashRate: raw.hashRate ?? null,
    hashRateChange7d: raw.hashRateChange7d ?? null,
    txVolume24h: raw.txVolume24h ?? null,
    mempoolSize: raw.mempoolSize ?? null,
    mempoolGrowthRate: 0,
    exchangeFlowEstimate: estimateExchangeFlow(raw.txVolume24h ?? null, raw.mempoolSize ?? null),
    activeAddresses24h: null, // Not available from free API
    difficulty: raw.difficulty ?? null,
    blockHeight: raw.blockHeight ?? null,
    timestamp: Date.now(),
  };

  // Cache result
  try {
    await redis.set(CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL });
  } catch {
    // Non-critical
  }

  return data;
}

/**
 * Score on-chain data from -100 to +100
 * Positive = bullish fundamentals, Negative = bearish
 */
export function scoreOnChain(data: OnChainData): {
  score: number;
  details: string;
  factors: { name: string; score: number; detail: string }[];
} {
  const factors: { name: string; score: number; detail: string }[] = [];
  let totalScore = 0;
  let count = 0;

  // Hash rate trend (growing = bullish for BTC network security)
  if (data.hashRateChange7d !== null) {
    let s = 0;
    if (data.hashRateChange7d > 5) s = 40;
    else if (data.hashRateChange7d > 0) s = 20;
    else if (data.hashRateChange7d > -5) s = -10;
    else s = -30;
    factors.push({ name: "Hash Rate 7d", score: s, detail: `${data.hashRateChange7d.toFixed(1)}% change` });
    totalScore += s;
    count++;
  }

  // Mempool congestion
  if (data.mempoolSize !== null) {
    let s = 0;
    if (data.mempoolSize > 80000) s = -40; // Very congested = potential sell pressure
    else if (data.mempoolSize > 40000) s = -15;
    else if (data.mempoolSize < 10000) s = 30; // Clear mempool = low pressure
    else s = 10;
    factors.push({ name: "Mempool", score: s, detail: `${data.mempoolSize.toLocaleString()} unconfirmed` });
    totalScore += s;
    count++;
  }

  // Exchange flow estimate
  {
    let s = 0;
    if (data.exchangeFlowEstimate === "outflow") s = 35; // Outflow = accumulation = bullish
    else if (data.exchangeFlowEstimate === "inflow") s = -35; // Inflow = selling = bearish
    factors.push({ name: "Exchange Flow", score: s, detail: data.exchangeFlowEstimate });
    totalScore += s;
    count++;
  }

  // Tx volume (high activity = healthy network)
  if (data.txVolume24h !== null) {
    let s = 0;
    if (data.txVolume24h > 500000) s = 25;
    else if (data.txVolume24h > 200000) s = 10;
    else s = -10;
    factors.push({ name: "TX Volume 24h", score: s, detail: `${(data.txVolume24h / 1000).toFixed(0)}k BTC` });
    totalScore += s;
    count++;
  }

  const finalScore = count > 0 ? Math.round(totalScore / count) : 0;
  const clamped = Math.max(-100, Math.min(100, finalScore));

  return {
    score: clamped,
    details: factors.map(f => `${f.name}: ${f.detail} (${f.score > 0 ? "+" : ""}${f.score})`).join(" | "),
    factors,
  };
}
