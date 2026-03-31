// ============================================
// GET /api/market/ohlcv — Historical OHLCV data
// Primary: Binance via market-data.ts
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

  // Validate symbol exists
  if (!SYMBOLS[symbol]) {
    return Response.json(
      { error: `Unknown symbol: ${symbol}. Valid: ${Object.keys(SYMBOLS).join(", ")}` },
      { status: 400 }
    );
  }

  const days = parseInt(searchParams.get("days") || "0", 10);
  const interval = searchParams.get("interval") as BinanceInterval | null;
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  try {
    let data;

    if (days > 0) {
      // Historical mode for backtest
      data = await getHistoricalOHLCV(symbol, days);
    } else if (interval) {
      // Chart mode with specific interval
      data = await getOHLCV(symbol, interval, limit);
    } else {
      // Default: 1h candles, 200 points
      data = await getOHLCV(symbol, "1h", 200);
    }

    if (!data || data.length === 0) {
      return Response.json(
        { error: "Aucune donnée disponible pour cette crypto/période" },
        { status: 502 }
      );
    }

    // Return in both formats for backward compatibility
    // Old format: { data: [...], crypto, days, count }
    // New format: direct array
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
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur de récupération des données" },
      { status: 500 }
    );
  }
}
