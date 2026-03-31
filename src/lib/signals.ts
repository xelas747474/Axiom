// ============================================
// Signal Level Utility — 9-level signal system
// ============================================

export type SignalLevel =
  | "EXTREME_FEAR"
  | "FEAR"
  | "HIGH_SELL"
  | "SELL"
  | "NEUTRAL"
  | "BUY"
  | "HIGH_BUY"
  | "GREED"
  | "EXTREME_GREED";

export interface SignalInfo {
  level: SignalLevel;
  label: string;
  color: string;
  emoji: string;
  description: string;
  bgColor: string;
}

const SIGNAL_LEVELS: { min: number; max: number; info: SignalInfo }[] = [
  { min: -100, max: -80, info: { level: "EXTREME_FEAR", label: "EXTREME FEAR", color: "#dc2626", emoji: "😱", description: "Panique sur le marché — opportunité contrarian ?", bgColor: "rgba(220,38,38,0.08)" } },
  { min: -80,  max: -60, info: { level: "FEAR",         label: "FEAR",         color: "#ef4444", emoji: "😨", description: "Sentiment très négatif — prudence maximale",        bgColor: "rgba(239,68,68,0.08)" } },
  { min: -60,  max: -40, info: { level: "HIGH_SELL",    label: "HIGH SELL",    color: "#f97316", emoji: "🔴", description: "Signaux baissiers dominants",                      bgColor: "rgba(249,115,22,0.07)" } },
  { min: -40,  max: -20, info: { level: "SELL",         label: "SELL",         color: "#fb923c", emoji: "📉", description: "Plus de vendeurs que d'acheteurs",                bgColor: "rgba(251,146,60,0.07)" } },
  { min: -20,  max:  20, info: { level: "NEUTRAL",      label: "NEUTRAL",      color: "#a3a3a3", emoji: "⚖️",  description: "Marché indécis — pas de signal clair",            bgColor: "rgba(163,163,163,0.06)" } },
  { min:  20,  max:  40, info: { level: "BUY",          label: "BUY",          color: "#4ade80", emoji: "📈", description: "Signaux modérément haussiers",                     bgColor: "rgba(74,222,128,0.08)" } },
  { min:  40,  max:  60, info: { level: "HIGH_BUY",     label: "HIGH BUY",     color: "#22c55e", emoji: "🟢", description: "Momentum haussier en construction",              bgColor: "rgba(34,197,94,0.08)" } },
  { min:  60,  max:  80, info: { level: "GREED",        label: "GREED",        color: "#16a34a", emoji: "🤑", description: "Sentiment très positif — attention au FOMO",        bgColor: "rgba(22,163,74,0.08)" } },
  { min:  80,  max: 100, info: { level: "EXTREME_GREED",label: "EXTREME GREED",color: "#15803d", emoji: "🚀", description: "Euphorie — risque de correction élevé",           bgColor: "rgba(21,128,61,0.08)" } },
];

export function getSignalInfo(score: number): SignalInfo {
  const clamped = Math.max(-100, Math.min(100, score));
  for (const entry of SIGNAL_LEVELS) {
    if (clamped >= entry.min && clamped < entry.max) return entry.info;
  }
  // Edge case: score === 100
  return SIGNAL_LEVELS[SIGNAL_LEVELS.length - 1].info;
}

export function getSignalColor(score: number): string {
  return getSignalInfo(score).color;
}

export function getScoreLabel(score: number): string {
  if (score > 40) return "(Haussier)";
  if (score > 10) return "(Légèrement haussier)";
  if (score > -10) return "(Neutre)";
  if (score > -40) return "(Légèrement baissier)";
  return "(Baissier)";
}

// Gauge gradient stops for the full 9-level spectrum
export const GAUGE_GRADIENT_STOPS = [
  { offset: "0%", color: "#dc2626" },
  { offset: "12.5%", color: "#ef4444" },
  { offset: "25%", color: "#f97316" },
  { offset: "37.5%", color: "#fb923c" },
  { offset: "50%", color: "#a3a3a3" },
  { offset: "62.5%", color: "#4ade80" },
  { offset: "75%", color: "#22c55e" },
  { offset: "87.5%", color: "#16a34a" },
  { offset: "100%", color: "#15803d" },
];
