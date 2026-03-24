// ============================================
// Bot Storage — localStorage persistence layer
// ============================================

import type {
  BotConfig,
  BotState,
  OpenPosition,
  ClosedTrade,
  PortfolioPoint,
  LogEntry,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_STATE } from "./types";

const KEYS = {
  config: "axiom_bot_config",
  state: "axiom_bot_state",
  positions: "axiom_bot_positions",
  history: "axiom_bot_history",
  curve: "axiom_bot_portfolio_curve",
  logs: "axiom_bot_logs",
} as const;

const MAX_LOGS = 500;
const MAX_CURVE_POINTS = 2000;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full — trim logs
    if (key !== KEYS.logs) {
      trimLogs();
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch { /* give up */ }
    }
  }
}

function trimLogs() {
  const logs = read<LogEntry[]>(KEYS.logs, []);
  if (logs.length > 200) {
    write(KEYS.logs, logs.slice(-200));
  }
}

// Config
export function loadConfig(): BotConfig {
  return { ...DEFAULT_CONFIG, ...read<Partial<BotConfig>>(KEYS.config, {}) };
}
export function saveConfig(config: BotConfig) {
  write(KEYS.config, config);
}

// State
export function loadState(): BotState {
  return { ...DEFAULT_STATE, ...read<Partial<BotState>>(KEYS.state, {}) };
}
export function saveState(state: BotState) {
  write(KEYS.state, state);
}

// Positions
export function loadPositions(): OpenPosition[] {
  return read<OpenPosition[]>(KEYS.positions, []);
}
export function savePositions(positions: OpenPosition[]) {
  write(KEYS.positions, positions);
}

// History
export function loadHistory(): ClosedTrade[] {
  return read<ClosedTrade[]>(KEYS.history, []);
}
export function saveHistory(history: ClosedTrade[]) {
  write(KEYS.history, history);
}

// Portfolio curve
export function loadCurve(): PortfolioPoint[] {
  return read<PortfolioPoint[]>(KEYS.curve, []);
}
export function saveCurve(curve: PortfolioPoint[]) {
  // Keep only last N points
  const trimmed = curve.length > MAX_CURVE_POINTS ? curve.slice(-MAX_CURVE_POINTS) : curve;
  write(KEYS.curve, trimmed);
}

// Logs
export function loadLogs(): LogEntry[] {
  return read<LogEntry[]>(KEYS.logs, []);
}
export function saveLogs(logs: LogEntry[]) {
  const trimmed = logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs;
  write(KEYS.logs, trimmed);
}

// Clear all bot data
export function clearBotData() {
  Object.values(KEYS).forEach((key) => {
    try { localStorage.removeItem(key); } catch { /* ok */ }
  });
}
