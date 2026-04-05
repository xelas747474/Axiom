// ============================================
// Bot Types — All type definitions for the trading bot
// ============================================

export type BotStrategy = "conservative" | "balanced" | "aggressive";
export type TradeDirection = "LONG" | "SHORT";
export type TradeCloseReason =
  | "take_profit"
  | "stop_loss"
  | "trailing_stop"
  | "signal_reversed"
  | "manual"
  | "max_drawdown";

export type TradedCrypto = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";

export const TRADED_CRYPTOS: { symbol: TradedCrypto; label: string; name: string; id: string }[] = [
  { symbol: "BTCUSDT", label: "BTC", name: "Bitcoin", id: "bitcoin" },
  { symbol: "ETHUSDT", label: "ETH", name: "Ethereum", id: "ethereum" },
  { symbol: "SOLUSDT", label: "SOL", name: "Solana", id: "solana" },
];

export interface StrategyConfig {
  label: string;
  emoji: string;
  tradesPerDay: [number, number];
  stopLossPct: number;
  takeProfitPct: number;
  scoreThreshold: number;
  positionSizePct: number;
  targetWinRate: number;
}

export const STRATEGIES: Record<BotStrategy, StrategyConfig> = {
  conservative: {
    label: "Conservative",
    emoji: "\u{1F6E1}\uFE0F",
    tradesPerDay: [1, 3],
    stopLossPct: 1.5,
    takeProfitPct: 2.5,
    scoreThreshold: 45,
    positionSizePct: 10,
    targetWinRate: 65,
  },
  balanced: {
    label: "Balanced",
    emoji: "\u2696\uFE0F",
    tradesPerDay: [3, 8],
    stopLossPct: 2.5,
    takeProfitPct: 4,
    scoreThreshold: 25,
    positionSizePct: 15,
    targetWinRate: 58,
  },
  aggressive: {
    label: "Aggressive",
    emoji: "\u{1F525}",
    tradesPerDay: [8, 20],
    stopLossPct: 4,
    takeProfitPct: 6,
    scoreThreshold: 15,
    positionSizePct: 25,
    targetWinRate: 52,
  },
};

export interface BotConfig {
  initialCapital: number;
  strategy: BotStrategy;
  allocations: Record<TradedCrypto, number>; // percentages summing to 100
  enabledCryptos: Record<TradedCrypto, boolean>;
  maxDrawdownPct: number;
  maxConcurrentTrades: number;
  trailingStop: boolean;
  cooldownMinutes: number;
}

export interface OpenPosition {
  id: string;
  crypto: TradedCrypto;
  direction: TradeDirection;
  entryPrice: number;
  entryTime: number; // timestamp ms
  size: number; // USDC amount
  stopLoss: number;
  takeProfit: number;
  trailingStopPrice: number | null;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
}

export interface ClosedTrade {
  id: string;
  tradeNumber: number;
  crypto: TradedCrypto;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  size: number;
  pnl: number;
  pnlPct: number;
  result: "win" | "loss";
  closeReason: TradeCloseReason;
}

export interface PortfolioPoint {
  t: number; // timestamp ms
  v: number; // value USDC
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: "scan" | "open" | "close" | "update" | "info" | "warning" | "error";
  message: string;
}

export interface BotState {
  running: boolean;
  startedAt: number | null; // timestamp ms
  portfolioValue: number;
  peakValue: number;
  currentDrawdown: number;
  lastTradeTime: Record<TradedCrypto, number>;
  todayTradeCount: number;
  todayPnl: number;
  initialized: boolean;
}

export const DEFAULT_CONFIG: BotConfig = {
  initialCapital: 10000,
  strategy: "balanced",
  allocations: { BTCUSDT: 50, ETHUSDT: 30, SOLUSDT: 20 },
  enabledCryptos: { BTCUSDT: true, ETHUSDT: true, SOLUSDT: true },
  maxDrawdownPct: 15,
  maxConcurrentTrades: 3,
  trailingStop: true,
  cooldownMinutes: 15,
};

export const DEFAULT_STATE: BotState = {
  running: false,
  startedAt: null,
  portfolioValue: 10000,
  peakValue: 10000,
  currentDrawdown: 0,
  lastTradeTime: { BTCUSDT: 0, ETHUSDT: 0, SOLUSDT: 0 },
  todayTradeCount: 0,
  todayPnl: 0,
  initialized: false,
};
