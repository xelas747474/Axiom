// ============================================
// OHLCV & Indicator Types — Core data structures
// ============================================

export interface OHLCV {
  time: number;    // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: number;
  value: number;
  color: string;
}

// Indicator result types

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface IchimokuResult {
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  senkouB: number[];
  chikou: number[];
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface KeltnerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export interface StochRSIResult {
  k: number[];
  d: number[];
}

export interface PivotPoints {
  pp: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface FibonacciLevels {
  high: number;
  low: number;
  levels: { ratio: number; price: number; label: string }[];
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
}

// Signal types

export type SignalStrength = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";

export interface IndicatorScore {
  name: string;
  score: number;       // -100 to +100
  signal: SignalStrength;
  description: string;
}

export interface CategoryScore {
  category: string;
  weight: number;
  score: number;
  signal: SignalStrength;
  indicators: IndicatorScore[];
}

export interface AISignalResult {
  globalScore: number;           // -100 to +100
  signal: SignalStrength;
  confidence: number;            // 0 to 100
  categories: CategoryScore[];
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  bullishReasons: string[];
  bearishReasons: string[];
}

// Supported cryptos
export const SUPPORTED_CRYPTOS = [
  { id: "bitcoin", symbol: "BTCUSDT", label: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETHUSDT", label: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOLUSDT", label: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNBUSDT", label: "BNB", name: "BNB" },
  { id: "ripple", symbol: "XRPUSDT", label: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADAUSDT", label: "ADA", name: "Cardano" },
  { id: "avalanche-2", symbol: "AVAXUSDT", label: "AVAX", name: "Avalanche" },
  { id: "chainlink", symbol: "LINKUSDT", label: "LINK", name: "Chainlink" },
  { id: "polkadot", symbol: "DOTUSDT", label: "DOT", name: "Polkadot" },
  { id: "matic-network", symbol: "MATICUSDT", label: "MATIC", name: "Polygon" },
] as const;

export type CryptoSymbol = (typeof SUPPORTED_CRYPTOS)[number]["symbol"];

export const TIMEFRAMES = [
  { label: "1H", interval: "1h", days: 2 },
  { label: "4H", interval: "4h", days: 10 },
  { label: "1D", interval: "1d", days: 120 },
  { label: "1W", interval: "1w", days: 365 },
  { label: "1M", interval: "1M", days: 730 },
] as const;

export type TimeframeLabel = (typeof TIMEFRAMES)[number]["label"];
