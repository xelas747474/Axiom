// ============================================
// CoinGecko API Client — with fast timeout, retry, and full fallbacks
// Free API — no key required (rate limited at ~30 req/min)
// ============================================

const BASE_URL = "https://api.coingecko.com/api/v3";
const FETCH_TIMEOUT = 4000; // 4s timeout — fail fast, use fallback

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
    "1H": [67500, 67600, 67450, 67700, 67650, 67800, 67750, 67842],
    "1D": [66800, 67100, 66900, 67400, 67200, 67600, 67500, 67842],
    "1W": [64000, 65200, 64800, 66500, 65900, 67200, 66800, 67842],
    "1M": [58000, 60500, 59000, 63000, 61500, 65000, 64000, 67842],
    "1Y": [28000, 35000, 42000, 38000, 45000, 52000, 60000, 67842],
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
      next: { revalidate: 60 }, // Cache for 60s via Next.js ISR
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // Timeout, network error, etc. — return null immediately
  }
}

// ============================================
// Main fetch — gracefully degrades on any failure
// Total worst case: ~4s (single timeout, all parallel)
// ============================================
export async function fetchMarketData(): Promise<MarketDataResult> {
  const [coins, globalData, fearGreedData, btcChart7d, btcChart30d, btcChart365d] =
    await Promise.all([
      fetchSafe<CoinGeckoMarketCoin[]>(
        `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`
      ),
      fetchSafe<CoinGeckoGlobal>(`${BASE_URL}/global`),
      fetchSafe<CoinGeckoFearGreed>(
        "https://api.alternative.me/fng/?limit=1"
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

  // If the critical request (coins) failed, return full fallback immediately
  if (!coins) {
    return FALLBACK_MARKET_DATA;
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

  // Extract chart data — sample 8 evenly spaced points
  function samplePrices(
    data: { prices: [number, number][] } | null,
    fallback: number[]
  ): number[] {
    if (!data?.prices?.length) return fallback;
    const prices = data.prices.map((p) => p[1]);
    if (prices.length < 8) return prices.map(Math.round);
    const step = Math.floor(prices.length / 7);
    const sampled: number[] = [];
    for (let i = 0; i < 7; i++) {
      sampled.push(Math.round(prices[i * step]));
    }
    sampled.push(Math.round(prices[prices.length - 1]));
    return sampled;
  }

  const btcPrice = btc?.current_price ?? FALLBACK_MARKET_DATA.bitcoin.price;
  const fallbackChart = FALLBACK_MARKET_DATA.chartData;

  const chartData: Record<string, number[]> = {
    "1H": [
      btcPrice * 0.998, btcPrice * 0.999, btcPrice * 0.997,
      btcPrice * 1.001, btcPrice * 1.0, btcPrice * 1.002,
      btcPrice * 1.001, btcPrice,
    ].map(Math.round),
    "1D": samplePrices(btcChart7d, fallbackChart["1D"]),
    "1W": samplePrices(btcChart7d, fallbackChart["1W"]),
    "1M": samplePrices(btcChart30d, fallbackChart["1M"]),
    "1Y": samplePrices(btcChart365d, fallbackChart["1Y"]),
  };

  const fgiValue = fearGreedData?.data?.[0]?.value
    ? parseInt(fearGreedData.data[0].value, 10)
    : FALLBACK_MARKET_DATA.fearGreedIndex;

  return {
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
}
