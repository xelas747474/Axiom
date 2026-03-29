// ============================================
// Advanced Scoring Engine — Unified 7-Component System
// Technical (20%) | Multi-TF (20%) | Sentiment (15%) | On-Chain (15%)
// Liquidation (10%) | Volume (10%) | Regime (10%)
// ============================================

import type { AISignalResult, SignalStrength } from "@/lib/indicators/types";
import type { OnChainData } from "@/lib/onchain";
import type { SentimentData } from "@/lib/sentiment";
import type { LiquidationData } from "@/lib/liquidation";
import type { MultiTimeframeData } from "@/lib/multi-timeframe";
import type { RegimeAnalysis } from "@/lib/market-regime";
import { scoreOnChain } from "@/lib/onchain";
import { scoreSentiment } from "@/lib/sentiment";
import { scoreLiquidation } from "@/lib/liquidation";
import { scoreMultiTimeframe } from "@/lib/multi-timeframe";
import { scoreRegime } from "@/lib/market-regime";

export interface ComponentScore {
  name: string;
  weight: number;
  score: number;         // -100 to +100
  signal: SignalStrength;
  details: string;
  factors: { name: string; score: number; detail: string }[];
}

export interface AdvancedSignalResult {
  // Core scores
  globalScore: number;           // -100 to +100
  signal: SignalStrength;
  confidence: number;            // 0 to 100
  components: ComponentScore[];

  // From original technical analysis
  technicalSignal: AISignalResult;

  // Trade recommendation
  recommendedDirection: "LONG" | "SHORT" | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  takeProfit2: number | null;    // Second TP target
  takeProfit3: number | null;    // Third TP target

  // Reasoning
  bullishReasons: string[];
  bearishReasons: string[];
  reasoning: string;             // Human-readable summary
}

function toSignal(score: number): SignalStrength {
  if (score > 60) return "STRONG_BUY";
  if (score > 20) return "BUY";
  if (score > -20) return "NEUTRAL";
  if (score > -60) return "SELL";
  return "STRONG_SELL";
}

export interface AdvancedScoringInput {
  technicalSignal: AISignalResult;
  onChainData: OnChainData | null;
  sentimentData: SentimentData | null;
  liquidationData: LiquidationData | null;
  multiTFData: MultiTimeframeData | null;
  regimeAnalysis: RegimeAnalysis | null;
  currentPrice: number;
  priceChange7d?: number;
}

export function computeAdvancedScore(input: AdvancedScoringInput): AdvancedSignalResult {
  const components: ComponentScore[] = [];

  // 1. Technical Analysis (20%)
  {
    const techScore = input.technicalSignal.globalScore;
    const factors = input.technicalSignal.categories.map(c => ({
      name: c.category,
      score: c.score,
      detail: `${c.indicators.length} indicators, weight ${(c.weight * 100).toFixed(0)}%`,
    }));
    components.push({
      name: "Technical",
      weight: 0.20,
      score: techScore,
      signal: toSignal(techScore),
      details: `Score: ${techScore}, Signal: ${input.technicalSignal.signal}`,
      factors,
    });
  }

  // 2. Multi-Timeframe (20%)
  if (input.multiTFData) {
    const mtf = scoreMultiTimeframe(input.multiTFData);
    components.push({
      name: "Multi-Timeframe",
      weight: 0.20,
      score: mtf.score,
      signal: toSignal(mtf.score),
      details: mtf.details,
      factors: mtf.factors,
    });
  } else {
    // Fallback: use technical score with reduced weight
    components.push({
      name: "Multi-Timeframe",
      weight: 0.20,
      score: Math.round(input.technicalSignal.globalScore * 0.5),
      signal: "NEUTRAL",
      details: "No multi-timeframe data — using technical fallback",
      factors: [],
    });
  }

  // 3. Sentiment (15%)
  if (input.sentimentData) {
    const sent = scoreSentiment(input.sentimentData, input.priceChange7d);
    components.push({
      name: "Sentiment",
      weight: 0.15,
      score: sent.score,
      signal: toSignal(sent.score),
      details: sent.details,
      factors: sent.factors,
    });
  } else {
    components.push({
      name: "Sentiment",
      weight: 0.15,
      score: 0,
      signal: "NEUTRAL",
      details: "No sentiment data",
      factors: [],
    });
  }

  // 4. On-Chain (15%)
  if (input.onChainData) {
    const oc = scoreOnChain(input.onChainData);
    components.push({
      name: "On-Chain",
      weight: 0.15,
      score: oc.score,
      signal: toSignal(oc.score),
      details: oc.details,
      factors: oc.factors,
    });
  } else {
    components.push({
      name: "On-Chain",
      weight: 0.15,
      score: 0,
      signal: "NEUTRAL",
      details: "No on-chain data",
      factors: [],
    });
  }

  // 5. Liquidation (10%)
  if (input.liquidationData) {
    const liq = scoreLiquidation(input.liquidationData);
    components.push({
      name: "Liquidation",
      weight: 0.10,
      score: liq.score,
      signal: toSignal(liq.score),
      details: liq.details,
      factors: liq.factors,
    });
  } else {
    components.push({
      name: "Liquidation",
      weight: 0.10,
      score: 0,
      signal: "NEUTRAL",
      details: "No liquidation data",
      factors: [],
    });
  }

  // 6. Volume (10%) — from technical analysis volume category
  {
    const volumeCat = input.technicalSignal.categories.find(
      c => c.category === "Volume"
    );
    const volScore = volumeCat?.score ?? 0;
    components.push({
      name: "Volume",
      weight: 0.10,
      score: volScore,
      signal: toSignal(volScore),
      details: volumeCat
        ? `${volumeCat.indicators.length} volume indicators`
        : "No volume data",
      factors: volumeCat?.indicators.map(i => ({
        name: i.name, score: i.score, detail: i.description,
      })) ?? [],
    });
  }

  // 7. Regime (10%)
  if (input.regimeAnalysis) {
    const reg = scoreRegime(input.regimeAnalysis);
    components.push({
      name: "Regime",
      weight: 0.10,
      score: reg.score,
      signal: toSignal(reg.score),
      details: reg.details,
      factors: [{
        name: "Market Regime",
        score: reg.score,
        detail: `${input.regimeAnalysis.regime} (${input.regimeAnalysis.confidence}% confidence)`,
      }],
    });
  } else {
    components.push({
      name: "Regime",
      weight: 0.10,
      score: 0,
      signal: "NEUTRAL",
      details: "No regime data",
      factors: [],
    });
  }

  // Compute weighted global score
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const globalScore = Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  );

  // Confidence: agreement between components
  const scores = components.map(c => c.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  // High agreement (low std dev) + high |score| = high confidence
  const agreementConfidence = Math.max(0, 100 - stdDev);
  const signalStrengthConfidence = Math.min(100, Math.abs(globalScore) * 1.5);
  const confidence = Math.round(Math.min(95, (agreementConfidence * 0.6 + signalStrengthConfidence * 0.4)));

  // Determine direction
  let recommendedDirection: "LONG" | "SHORT" | null = null;
  if (globalScore > 20 && confidence >= 30) recommendedDirection = "LONG";
  else if (globalScore < -20 && confidence >= 30) recommendedDirection = "SHORT";

  // Entry, SL, TP from technical signal
  const { entryPrice, stopLoss, takeProfit } = input.technicalSignal;

  // Multi-target TP: TP2 = 1.5x distance, TP3 = 2.5x distance
  const tpDistance = Math.abs(takeProfit - entryPrice);
  const takeProfit2 = tpDistance > 0
    ? (recommendedDirection === "LONG" || globalScore > 0
      ? entryPrice + tpDistance * 1.5
      : entryPrice - tpDistance * 1.5)
    : null;
  const takeProfit3 = tpDistance > 0
    ? (recommendedDirection === "LONG" || globalScore > 0
      ? entryPrice + tpDistance * 2.5
      : entryPrice - tpDistance * 2.5)
    : null;

  // Collect reasons
  const bullishReasons: string[] = [];
  const bearishReasons: string[] = [];
  for (const comp of components) {
    if (comp.score > 20) {
      bullishReasons.push(`${comp.name}: ${comp.details}`);
    } else if (comp.score < -20) {
      bearishReasons.push(`${comp.name}: ${comp.details}`);
    }
  }
  if (bullishReasons.length === 0) bullishReasons.push("No strong bullish signal");
  if (bearishReasons.length === 0) bearishReasons.push("No strong bearish signal");

  // Generate reasoning summary
  const topBullish = components.filter(c => c.score > 15).sort((a, b) => b.score - a.score).slice(0, 3);
  const topBearish = components.filter(c => c.score < -15).sort((a, b) => a.score - b.score).slice(0, 3);
  const regimeStr = input.regimeAnalysis ? ` Regime: ${input.regimeAnalysis.regime}.` : "";

  let reasoning = `Score: ${globalScore} (${toSignal(globalScore)}), Confidence: ${confidence}%.${regimeStr}`;
  if (topBullish.length > 0) {
    reasoning += ` Bullish: ${topBullish.map(c => `${c.name}(+${c.score})`).join(", ")}.`;
  }
  if (topBearish.length > 0) {
    reasoning += ` Bearish: ${topBearish.map(c => `${c.name}(${c.score})`).join(", ")}.`;
  }

  return {
    globalScore: Math.max(-100, Math.min(100, globalScore)),
    signal: toSignal(globalScore),
    confidence,
    components,
    technicalSignal: input.technicalSignal,
    recommendedDirection,
    entryPrice,
    stopLoss,
    takeProfit,
    takeProfit2,
    takeProfit3,
    bullishReasons,
    bearishReasons,
    reasoning,
  };
}
