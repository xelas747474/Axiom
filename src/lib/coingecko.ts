// ============================================
// CoinGecko API Client — with fast timeout, retry, and full fallbacks
// Free API — no key required (rate limited at ~30 req/min)
// ============================================

const BASE_URL = "https://api.coingecko.com/api/v3";
const FETCH_TIMEOUT = 6000; // 6s timeout — a bit more room for slow API

// ============================================
// Server-side in-memory cache — prevents flickering between live & fallback
// When CoinGecko rate-limits, we return the LAST known live data
// ============================================
let cachedResult: MarketDataResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 25_000; // 25s — slightly under the 30s ISR revalidate

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
}

interface CoinGeckoGlobal {
  data: {
    total_market_cap: { usd: number };
    market_cap_percentage: { btc: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

interface CoinGeckoFearGreed {
  data: Array<{
    value: string;
    value_classification: string;
  }>;
}

export interface MarketDataResult {
  bitcoin: { price: number; change24h: number };
  ethereum: { price: number; change24h: number };
  marketCap: number;
  btcDominance: number;
  fearGreedIndex: number;
  topGainers: Array<{
    name: string;
    symbol: string;
    price: number;
    change24h: number;
  }>;
  topLosers: Array<{
    name: string;
    symbol: string;
    price: number;
    change24h: number;
  }>;
  chartData: Record<string, number[]>;
  isLive: boolean;
}

// ============================================
// Full fallback data — used when API is unreachable
// ============================================
export const FALLBACK_MARKET_DATA: MarketDataResult = {
  bitcoin: { price: 67842.5, change24h: 2.34 },
  ethereum: { price: 3521.18, change24h: -0.87 },
  marketCap: 2.47,
  btcDominance: 54.2,
  fearGreedIndex: 62,
  topGainers: [
    { name: "Solana", symbol: "SOL", price: 178.42, change24h: 8.56 },
    { name: "Avalanche", symbol: "AVAX", price: 42.18, change24h: 6.23 },
    { name: "Chainlink", symbol: "LINK", price: 18.95, change24h: 5.12 },
    { name: "Render", symbol: "RNDR", price: 11.24, change24h: 4.87 },
    { name: "Injective", symbol: "INJ", price: 35.67, change24h: 4.15 },
  ],
  topLosers: [
    { name: "Dogecoin", symbol: "DOGE", price: 0.1234, change24h: -5.67 },
    { name: "Shiba Inu", symbol: "SHIB", price: 0.00002345, change24h: -4.89 },
    { name: "Cardano", symbol: "ADA", price: 0.5678, change24h: -3.45 },
    { name: "Polkadot", symbol: "DOT", price: 7.89, change24h: -2.98 },
    { name: "Cosmos", symbol: "ATOM", price: 9.12, change24h: -2.34 },
  ],
  chartData: {
    "1H": [67500, 67550, 67600, 67580, 67450, 67520, 67700, 67650, 67680, 67800, 67750, 67842],
    "1D": [66800, 66950, 67100, 67050, 66900, 67000, 67200, 67400, 67350, 67200, 67300, 67600, 67500, 67450, 67550, 67650, 67700, 67600, 67700, 67750, 67800, 67780, 67820, 67842],
    "1W": [64000, 64300, 64600, 65200, 65000, 64800, 65100, 65400, 65800, 66200, 66500, 66300, 65900, 66100, 66400, 66700, 67000, 67200, 67100, 66800, 66900, 67100, 67300, 67500, 67400, 67300, 67500, 67600, 67700, 67842],
    "1M": [58000, 58500, 59200, 60500, 60000, 59000, 59500, 60200, 61000, 61800, 63000, 62500, 61500, 62000, 62800, 63500, 64200, 65000, 64500, 64000, 64800, 65500, 66200, 66800, 67000, 67200, 67500, 67842],
    "1Y": [28000, 30000, 32000, 35000, 33000, 37000, 42000, 40000, 38000, 41000, 43000, 45000, 44000, 47000, 49000, 52000, 50000, 53000, 55000, 57000, 60000, 62000, 64000, 66000, 67842],
  },
  isLive: false,
};

// ============================================
// Fetch with timeout — single attempt, fail fast
// Next.js revalidate handles caching at the route level
// ============================================
async function fetchSafe<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

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

// ============================================
// Main fetch — gracefully degrades on any failure
// Total worst case: ~4s (single timeout, all parallel)
// ============================================
export async function fetchMarketData(): Promise<MarketDataResult> {
  // Return cached data if still fresh
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedResult;
  }

  const [coins, globalData, fearGreedData, btcChart1d, btcChart7d, btcChart30d, btcChart365d] =
    await Promise.all([
      fetchSafe<CoinGeckoMarketCoin[]>(
        `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`
      ),
      fetchSafe<CoinGeckoGlobal>(`${BASE_URL}/global`),
      fetchSafe<CoinGeckoFearGreed>(
        "https://api.alternative.me/fng/?limit=1"
      ),
      fetchSafe<{ prices: [number, number][] }>(
        `${BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=1`
      ),
      fetchSafe<{ prices: [number, number][] }>(
        `${BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=7`
      ),
      fetchSafe<{ prices: [number, number][] }>(
        `${BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=30`
      ),
      fetchSafe<{ prices: [number, number][] }>(
        `${BASE_URL}/coins/bitcoin/market_chart?vs_currency=usd&days=365`
      ),
    ]);

  // If the critical request (coins) failed, return cached or fallback
  if (!coins) {
    return cachedResult ?? FALLBACK_MARKET_DATA;
  }

  const btc = coins.find((c) => c.id === "bitcoin");
  const eth = coins.find((c) => c.id === "ethereum");

  // Sort by 24h change for gainers/losers
  const sorted = [...coins]
    .filter((c) => c.price_change_percentage_24h != null)
    .sort(
      (a, b) =>
        b.price_change_percentage_24h - a.price_change_percentage_24h
    );

  const topGainers = sorted.slice(0, 5).map((c) => ({
    name: c.name,
    symbol: c.symbol.toUpperCase(),
    price: c.current_price,
    change24h: Math.round(c.price_change_percentage_24h * 100) / 100,
  }));

  const topLosers = sorted
    .slice(-5)
    .reverse()
    .map((c) => ({
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      price: c.current_price,
      change24h: Math.round(c.price_change_percentage_24h * 100) / 100,
    }));

  // Extract chart data — sample N evenly spaced points for smooth curves
  function samplePrices(
    data: { prices: [number, number][] } | null,
    fallback: number[],
    targetPoints = 48
  ): number[] {
    if (!data?.prices?.length) return fallback;
    const prices = data.prices.map((p) => p[1]);
    if (prices.length <= targetPoints) return prices.map(Math.round);
    const step = (prices.length - 1) / (targetPoints - 1);
    const sampled: number[] = [];
    for (let i = 0; i < targetPoints - 1; i++) {
      sampled.push(Math.round(prices[Math.round(i * step)]));
    }
    sampled.push(Math.round(prices[prices.length - 1]));
    return sampled;
  }

  const fallbackChart = FALLBACK_MARKET_DATA.chartData;

  // 1H: last ~12 points from 1-day data (each ~5min granularity from CoinGecko)
  let hourData = fallbackChart["1H"];
  if (btcChart1d?.prices?.length) {
    const prices = btcChart1d.prices.map((p) => p[1]);
    // Take the last ~12 data points for "1 hour" view
    const lastN = Math.min(12, prices.length);
    hourData = prices.slice(-lastN).map(Math.round);
  }

  const chartData: Record<string, number[]> = {
    "1H": hourData,
    "1D": samplePrices(btcChart1d, fallbackChart["1D"], 24),
    "1W": samplePrices(btcChart7d, fallbackChart["1W"], 48),
    "1M": samplePrices(btcChart30d, fallbackChart["1M"], 48),
    "1Y": samplePrices(btcChart365d, fallbackChart["1Y"], 52),
  };

  const fgiValue = fearGreedData?.data?.[0]?.value
    ? parseInt(fearGreedData.data[0].value, 10)
    : FALLBACK_MARKET_DATA.fearGreedIndex;

  const result: MarketDataResult = {
    bitcoin: {
      price: btc?.current_price ?? FALLBACK_MARKET_DATA.bitcoin.price,
      change24h:
        Math.round((btc?.price_change_percentage_24h ?? FALLBACK_MARKET_DATA.bitcoin.change24h) * 100) / 100,
    },
    ethereum: {
      price: eth?.current_price ?? FALLBACK_MARKET_DATA.ethereum.price,
      change24h:
        Math.round((eth?.price_change_percentage_24h ?? FALLBACK_MARKET_DATA.ethereum.change24h) * 100) / 100,
    },
    marketCap: globalData
      ? Math.round((globalData.data.total_market_cap.usd / 1e12) * 100) / 100
      : FALLBACK_MARKET_DATA.marketCap,
    btcDominance: globalData
      ? Math.round(globalData.data.market_cap_percentage.btc * 10) / 10
      : FALLBACK_MARKET_DATA.btcDominance,
    fearGreedIndex: fgiValue,
    topGainers: topGainers.length > 0 ? topGainers : FALLBACK_MARKET_DATA.topGainers,
    topLosers: topLosers.length > 0 ? topLosers : FALLBACK_MARKET_DATA.topLosers,
    chartData,
    isLive: true,
  };

  // Cache successful live data — so rate-limit failures still show last known data
  cachedResult = result;
  cacheTimestamp = Date.now();

  return result;
}
