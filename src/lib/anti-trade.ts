// ============================================
// Anti-Trade Filters — Prevents bad entries
// Tilt protection, low liquidity hours, extreme sentiment
// ============================================

import type { MarketRegime } from "@/lib/market-regime";
import type { SentimentData } from "@/lib/sentiment";
import type { ClosedTrade } from "@/lib/bot/types";

export interface AntiTradeResult {
  shouldTrade: boolean;
  reasons: string[];
  filters: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

interface AntiTradeInput {
  recentTrades: ClosedTrade[];         // Last N trades for tilt detection
  currentHourUTC: number;              // 0-23
  regime: MarketRegime;
  sentiment: SentimentData | null;
  consecutiveLosses: number;
  currentDrawdownPct: number;
  maxDrawdownPct: number;
}

/**
 * Tilt protection: detect losing streaks and reduce exposure
 * Returns false (block trade) if the bot is on tilt
 */
function checkTiltProtection(
  recentTrades: ClosedTrade[],
  consecutiveLosses: number,
): { passed: boolean; detail: string } {
  // Block after 3+ consecutive losses
  if (consecutiveLosses >= 3) {
    return {
      passed: false,
      detail: `${consecutiveLosses} consecutive losses — cooling down`,
    };
  }

  // Check recent P&L: if last 5 trades are net negative by >3%, pause
  const last5 = recentTrades.slice(-5);
  if (last5.length >= 5) {
    const netPnlPct = last5.reduce((sum, t) => sum + t.pnlPct, 0);
    if (netPnlPct < -3) {
      return {
        passed: false,
        detail: `Last 5 trades net ${netPnlPct.toFixed(2)}% — tilt protection`,
      };
    }
  }

  return { passed: true, detail: "No tilt detected" };
}

/**
 * Low liquidity hours filter
 * Avoid trading during low-volume periods (weekends, late night UTC)
 */
function checkLiquidityHours(hourUTC: number): { passed: boolean; detail: string } {
  // UTC times when crypto volume tends to be lowest:
  // 0-3 UTC on weekdays (Asia winding down, US asleep)
  // Note: crypto trades 24/7 but volume dips significantly
  // We allow but flag — this is a soft filter
  const lowVolHours = [0, 1, 2, 3];

  if (lowVolHours.includes(hourUTC)) {
    return {
      passed: true, // Soft filter — don't block, just flag
      detail: `Low liquidity period (${hourUTC}:00 UTC) — reduced confidence`,
    };
  }

  return { passed: true, detail: `Normal volume hours (${hourUTC}:00 UTC)` };
}

/**
 * Extreme sentiment filter
 * Block trades that go WITH the crowd during extreme readings
 */
function checkExtremeSentiment(
  sentiment: SentimentData | null,
  proposedDirection: "LONG" | "SHORT" | null,
): { passed: boolean; detail: string } {
  if (!sentiment) return { passed: true, detail: "No sentiment data" };

  const fgv = sentiment.fearGreedValue;

  // Extreme greed (>90): block LONG entries (everyone is already long)
  if (fgv >= 90 && proposedDirection === "LONG") {
    return {
      passed: false,
      detail: `Extreme greed (${fgv}) — blocking LONG entry`,
    };
  }

  // Extreme fear (<10): block SHORT entries (everyone is already panic selling)
  if (fgv <= 10 && proposedDirection === "SHORT") {
    return {
      passed: false,
      detail: `Extreme fear (${fgv}) — blocking SHORT entry`,
    };
  }

  return { passed: true, detail: `Sentiment ${fgv} — OK for ${proposedDirection ?? "any"} direction` };
}

/**
 * Drawdown proximity filter
 * Reduce or block trading when approaching max drawdown
 */
function checkDrawdownProximity(
  currentDrawdownPct: number,
  maxDrawdownPct: number,
): { passed: boolean; detail: string } {
  const remaining = maxDrawdownPct - currentDrawdownPct;

  // Within 2% of max drawdown — block all trades
  if (remaining <= 2) {
    return {
      passed: false,
      detail: `Only ${remaining.toFixed(1)}% from max drawdown — blocking trades`,
    };
  }

  // Within 5% — flag as warning
  if (remaining <= 5) {
    return {
      passed: true,
      detail: `${remaining.toFixed(1)}% from max drawdown — proceed with caution`,
    };
  }

  return { passed: true, detail: `Drawdown OK (${currentDrawdownPct.toFixed(1)}% / ${maxDrawdownPct}%)` };
}

/**
 * Regime filter: avoid certain trades in certain regimes
 */
function checkRegimeFilter(
  regime: MarketRegime,
  proposedDirection: "LONG" | "SHORT" | null,
): { passed: boolean; detail: string } {
  // In volatile regime, be extra cautious — block if no clear direction
  if (regime === "volatile" && !proposedDirection) {
    return {
      passed: false,
      detail: "Volatile regime — no clear signal direction",
    };
  }

  // In trending regime, warn against counter-trend trades
  if (regime === "trending_up" && proposedDirection === "SHORT") {
    return {
      passed: true, // Soft filter — allow but reduce confidence
      detail: "Counter-trend SHORT in uptrend — reduced confidence",
    };
  }
  if (regime === "trending_down" && proposedDirection === "LONG") {
    return {
      passed: true,
      detail: "Counter-trend LONG in downtrend — reduced confidence",
    };
  }

  return { passed: true, detail: `Regime ${regime} — OK for ${proposedDirection ?? "any"}` };
}

/**
 * Run all anti-trade filters
 * Returns whether the trade should proceed and detailed reasoning
 */
export function evaluateAntiTradeFilters(
  input: AntiTradeInput,
  proposedDirection: "LONG" | "SHORT" | null = null,
): AntiTradeResult {
  const filters = [
    { name: "Tilt Protection", ...checkTiltProtection(input.recentTrades, input.consecutiveLosses) },
    { name: "Liquidity Hours", ...checkLiquidityHours(input.currentHourUTC) },
    { name: "Extreme Sentiment", ...checkExtremeSentiment(input.sentiment, proposedDirection) },
    { name: "Drawdown Limit", ...checkDrawdownProximity(input.currentDrawdownPct, input.maxDrawdownPct) },
    { name: "Regime Filter", ...checkRegimeFilter(input.regime, proposedDirection) },
  ];

  const blocked = filters.filter(f => !f.passed);
  const shouldTrade = blocked.length === 0;

  return {
    shouldTrade,
    reasons: blocked.map(f => `[${f.name}] ${f.detail}`),
    filters,
  };
}

/**
 * Count consecutive losses from trade history
 */
export function countConsecutiveLosses(trades: ClosedTrade[]): number {
  let count = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].result === "loss") count++;
    else break;
  }
  return count;
}
