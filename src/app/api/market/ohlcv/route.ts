// ============================================
// GET /api/market/ohlcv — Historical OHLCV data
// Primary: Binance (multi-endpoint) via market-data.ts | Fallback: CoinGecko
// Used by: backtest engine, trading charts
// ============================================

import { getHistoricalOHLCV, getOHLCV } from "@/lib/market-data";
import { SYMBOLS } from "@/lib/binance";
import type { BinanceInterval } from "@/lib/binance";

export const dynamic = "force-dynamic";

// Accept both CoinGecko IDs (bitcoin/ethereum/solana) and AXIOM symbols (BTC/ETH/SOL)
const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  binancecoin: "BNB",
  ripple: "XRP",
  cardano: "ADA",
  "avalanche-2": "AVAX",
  chainlink: "LINK",
  polkadot: "DOT",
  "matic-network": "MATIC",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Accept 'symbol=BTC' or 'crypto=bitcoin' (legacy)
  let symbol = (searchParams.get("symbol") || "").toUpperCase();
  const crypto = searchParams.get("crypto") || "";

  // Resolve CoinGecko ID to symbol
  if (!symbol && crypto) {
    symbol = ID_TO_SYMBOL[crypto.toLowerCase()] || crypto.toUpperCase();
  }
  if (!symbol) symbol = "BTC";

  const days = parseInt(searchParams.get("days") || "0", 10);
  const interval = searchParams.get("interval") as BinanceInterval | null;
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  console.log(`[ohlcv] Request: symbol=${symbol}, days=${days}, interval=${interval}, limit=${limit}, raw_crypto=${crypto}`);

  // Validate symbol exists
  if (!SYMBOLS[symbol]) {
    console.error(`[ohlcv] Unknown symbol: ${symbol}`);
    return Response.json(
      { error: `Unknown symbol: ${symbol}. Valid: ${Object.keys(SYMBOLS).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    let data;

    if (days > 0) {
      // Historical mode for backtest
      console.log(`[ohlcv] Fetching historical: ${symbol} / ${days} days`);
      data = await getHistoricalOHLCV(symbol, days);
      console.log(`[ohlcv] Historical result: ${data?.length ?? 0} candles`);
    } else if (interval) {
      // Chart mode with specific interval
      console.log(`[ohlcv] Fetching chart: ${symbol} / ${interval} / ${limit}`);
      data = await getOHLCV(symbol, interval, limit);
      console.log(`[ohlcv] Chart result: ${data?.length ?? 0} candles`);
    } else {
      // Default: 1h candles, 200 points
      data = await getOHLCV(symbol, "1h", 200);
      console.log(`[ohlcv] Default result: ${data?.length ?? 0} candles`);
    }

    if (!data || data.length === 0) {
      console.error(`[ohlcv] No data returned for ${symbol}/${days}d from any source`);
      return Response.json(
        { error: `Aucune donnée disponible pour ${symbol} — Binance et CoinGecko ont échoué`, symbol, days },
        { status: 502 }
      );
    }

    // Return in both formats for backward compatibility
    if (days > 0) {
      return Response.json({
        crypto: crypto || symbol,
        symbol,
        days,
        count: data.length,
        data,
        source: "binance",
      });
    }

    return Response.json(data);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ohlcv] Exception for ${symbol}/${days}d: ${errMsg}`);
    return Response.json(
      { error: errMsg, symbol, days },
      { status: 500 }
    );
  }
}
