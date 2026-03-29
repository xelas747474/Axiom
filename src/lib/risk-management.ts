// ============================================
// Risk Management — Kelly Criterion, Dynamic SL/TP, Position Sizing
// ============================================

import type { ClosedTrade, BotConfig, BotState } from "@/lib/bot/types";
import type { RegimeAnalysis, StrategyAdjustment } from "@/lib/market-regime";
import { getRegimeAdjustment } from "@/lib/market-regime";
import { STRATEGIES } from "@/lib/bot/types";

export interface PositionSizing {
  size: number;              // USDT position size
  riskAmount: number;        // Max loss in USDT
  riskPct: number;           // % of portfolio at risk
  kellyFraction: number;     // Kelly criterion output (0-1)
  adjustedKelly: number;     // Half-Kelly or regime-adjusted
  reasoning: string;
}

export interface DynamicLevels {
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number | null;
  takeProfit3: number | null;
  trailingActivation: number | null; // Price at which trailing stop activates
  reasoning: string;
}

/**
 * Kelly Criterion: f* = (p * b - q) / b
 * Where:
 *   p = win probability
 *   b = avg win / avg loss (win/loss ratio)
 *   q = 1 - p (loss probability)
 *
 * We use half-Kelly for safety
 */
function computeKellyFraction(trades: ClosedTrade[]): number {
  if (trades.length < 10) return 0.05; // Default conservative fraction with insufficient data

  const wins = trades.filter(t => t.result === "win");
  const losses = trades.filter(t => t.result === "loss");

  if (losses.length === 0) return 0.15; // Cap at 15% if somehow all wins
  if (wins.length === 0) return 0.02;   // Minimum if all losses

  const p = wins.length / trades.length;
  const q = 1 - p;
  const avgWin = wins.reduce((s, t) => s + Math.abs(t.pnlPct), 0) / wins.length;
  const avgLoss = losses.reduce((s, t) => s + Math.abs(t.pnlPct), 0) / losses.length;

  if (avgLoss === 0) return 0.15;
  const b = avgWin / avgLoss;

  const kelly = (p * b - q) / b;

  // Half-Kelly for safety, clamped between 2% and 20%
  return Math.max(0.02, Math.min(0.20, kelly / 2));
}

/**
 * Compute position size using Kelly Criterion adjusted for regime
 */
export function computePositionSize(
  config: BotConfig,
  state: BotState,
  trades: ClosedTrade[],
  regime: RegimeAnalysis | null,
  signalConfidence: number,
): PositionSizing {
  const strat = STRATEGIES[config.strategy];
  const portfolio = state.portfolioValue;

  // Base Kelly fraction from historical performance
  const kellyFraction = computeKellyFraction(trades);

  // Adjust for regime
  let regimeMultiplier = 1.0;
  if (regime) {
    const adj = getRegimeAdjustment(regime);
    regimeMultiplier = adj.positionSizeMultiplier;
  }

  // Adjust for signal confidence (0-100 mapped to 0.5-1.0 multiplier)
  const confidenceMultiplier = 0.5 + (signalConfidence / 100) * 0.5;

  // Adjusted Kelly
  const adjustedKelly = kellyFraction * regimeMultiplier * confidenceMultiplier;

  // Cap by strategy's max position size
  const maxPct = strat.positionSizePct / 100;
  const finalPct = Math.min(adjustedKelly, maxPct);

  const size = Math.round(portfolio * finalPct);
  const riskAmount = Math.round(size * (strat.stopLossPct / 100));

  const reasons: string[] = [
    `Kelly: ${(kellyFraction * 100).toFixed(1)}%`,
    `Regime adj: ${regimeMultiplier.toFixed(2)}x`,
    `Confidence adj: ${confidenceMultiplier.toFixed(2)}x`,
    `Final: ${(finalPct * 100).toFixed(1)}% = $${size}`,
  ];

  return {
    size,
    riskAmount,
    riskPct: finalPct * 100,
    kellyFraction,
    adjustedKelly: finalPct,
    reasoning: reasons.join(" | "),
  };
}

/**
 * Compute dynamic SL/TP based on volatility (ATR) and regime
 */
export function computeDynamicLevels(
  entryPrice: number,
  direction: "LONG" | "SHORT",
  atrValue: number,
  config: BotConfig,
  regime: RegimeAnalysis | null,
  signalConfidence: number,
): DynamicLevels {
  const strat = STRATEGIES[config.strategy];
  let adjustment: StrategyAdjustment | null = null;
  if (regime) {
    adjustment = getRegimeAdjustment(regime);
  }

  // Base SL/TP distances from ATR
  const baseSLDistance = atrValue * 2;     // 2x ATR for SL
  const baseTPDistance = atrValue * 3;     // 3x ATR for TP1 (1.5:1 R:R minimum)

  // Apply regime multipliers
  const slMult = adjustment?.stopLossMultiplier ?? 1.0;
  const tpMult = adjustment?.takeProfitMultiplier ?? 1.0;

  // Apply confidence: higher confidence = tighter SL, wider TP
  const confFactor = 0.8 + (signalConfidence / 100) * 0.4; // 0.8-1.2

  const slDistance = baseSLDistance * slMult * (1 / confFactor); // Tighter when confident
  const tp1Distance = baseTPDistance * tpMult * confFactor;     // Wider when confident

  // Cap SL by strategy max
  const maxSL = entryPrice * (strat.stopLossPct / 100);
  const finalSLDistance = Math.min(slDistance, maxSL);

  // Compute levels
  const isLong = direction === "LONG";
  const stopLoss = isLong
    ? entryPrice - finalSLDistance
    : entryPrice + finalSLDistance;

  const takeProfit1 = isLong
    ? entryPrice + tp1Distance
    : entryPrice - tp1Distance;

  // TP2: 1.5x distance from TP1
  const takeProfit2 = isLong
    ? entryPrice + tp1Distance * 1.5
    : entryPrice - tp1Distance * 1.5;

  // TP3: 2.5x distance (only in trending regimes)
  const showTP3 = regime?.regime === "trending_up" || regime?.regime === "trending_down";
  const takeProfit3 = showTP3
    ? (isLong ? entryPrice + tp1Distance * 2.5 : entryPrice - tp1Distance * 2.5)
    : null;

  // Trailing stop activation: after reaching 1x ATR profit
  const trailingActivation = adjustment?.trailingStopEnabled !== false
    ? (isLong ? entryPrice + atrValue : entryPrice - atrValue)
    : null;

  const reasons: string[] = [
    `ATR: ${atrValue.toFixed(2)}`,
    `SL: ${finalSLDistance.toFixed(2)} (${((finalSLDistance / entryPrice) * 100).toFixed(2)}%)`,
    `TP1: ${tp1Distance.toFixed(2)} (R:R ${(tp1Distance / finalSLDistance).toFixed(1)}:1)`,
    regime ? `Regime: ${regime.regime}` : "No regime",
  ];

  return {
    stopLoss: Math.round(stopLoss * 100) / 100,
    takeProfit1: Math.round(takeProfit1 * 100) / 100,
    takeProfit2: Math.round(takeProfit2 * 100) / 100,
    takeProfit3: takeProfit3 !== null ? Math.round(takeProfit3 * 100) / 100 : null,
    trailingActivation: trailingActivation !== null ? Math.round(trailingActivation * 100) / 100 : null,
    reasoning: reasons.join(" | "),
  };
}

/**
 * Compute risk/reward ratio
 */
export function computeRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (risk === 0) return 0;
  return Math.round((reward / risk) * 100) / 100;
}

/**
 * Validate that a proposed trade meets minimum risk/reward requirements
 */
export function validateTrade(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  minRR: number = 1.5,
): { valid: boolean; rr: number; reason: string } {
  const rr = computeRiskReward(entryPrice, stopLoss, takeProfit);

  if (rr < minRR) {
    return {
      valid: false,
      rr,
      reason: `R:R ${rr.toFixed(1)}:1 below minimum ${minRR}:1`,
    };
  }

  return {
    valid: true,
    rr,
    reason: `R:R ${rr.toFixed(1)}:1 — meets minimum`,
  };
}
