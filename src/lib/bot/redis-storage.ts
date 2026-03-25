// ============================================
// Bot Redis Storage — Server-side persistence layer
// ============================================

import { getRedis, REDIS_KEYS } from "@/lib/redis";
import type {
  BotConfig,
  BotState,
  OpenPosition,
  ClosedTrade,
  PortfolioPoint,
  LogEntry,
} from "./types";
import { DEFAULT_CONFIG, DEFAULT_STATE } from "./types";

const MAX_LOGS = 500;
const MAX_CURVE_POINTS = 2000;

// Config
export async function loadConfigRedis(): Promise<BotConfig> {
  const r = getRedis();
  const raw = await r.get<BotConfig>(REDIS_KEYS.botConfig);
  return raw ? { ...DEFAULT_CONFIG, ...raw } : { ...DEFAULT_CONFIG };
}
export async function saveConfigRedis(config: BotConfig): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.botConfig, JSON.stringify(config));
}

// State
export async function loadStateRedis(): Promise<BotState> {
  const r = getRedis();
  const raw = await r.get<BotState>(REDIS_KEYS.botState);
  return raw ? { ...DEFAULT_STATE, ...raw } : { ...DEFAULT_STATE };
}
export async function saveStateRedis(state: BotState): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.botState, JSON.stringify(state));
}

// Positions
export async function loadPositionsRedis(): Promise<OpenPosition[]> {
  const r = getRedis();
  const raw = await r.get<OpenPosition[]>(REDIS_KEYS.botPositions);
  return raw ?? [];
}
export async function savePositionsRedis(positions: OpenPosition[]): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.botPositions, JSON.stringify(positions));
}

// History
export async function loadHistoryRedis(): Promise<ClosedTrade[]> {
  const r = getRedis();
  const raw = await r.get<ClosedTrade[]>(REDIS_KEYS.botHistory);
  return raw ?? [];
}
export async function saveHistoryRedis(history: ClosedTrade[]): Promise<void> {
  const r = getRedis();
  await r.set(REDIS_KEYS.botHistory, JSON.stringify(history));
}

// Portfolio curve
export async function loadCurveRedis(): Promise<PortfolioPoint[]> {
  const r = getRedis();
  const raw = await r.get<PortfolioPoint[]>(REDIS_KEYS.botCurve);
  return raw ?? [];
}
export async function saveCurveRedis(curve: PortfolioPoint[]): Promise<void> {
  const r = getRedis();
  const trimmed = curve.length > MAX_CURVE_POINTS ? curve.slice(-MAX_CURVE_POINTS) : curve;
  await r.set(REDIS_KEYS.botCurve, JSON.stringify(trimmed));
}

// Logs
export async function loadLogsRedis(): Promise<LogEntry[]> {
  const r = getRedis();
  const raw = await r.get<LogEntry[]>(REDIS_KEYS.botLogs);
  return raw ?? [];
}
export async function saveLogsRedis(logs: LogEntry[]): Promise<void> {
  const r = getRedis();
  const trimmed = logs.length > MAX_LOGS ? logs.slice(-MAX_LOGS) : logs;
  await r.set(REDIS_KEYS.botLogs, JSON.stringify(trimmed));
}

// Clear all bot data
export async function clearBotDataRedis(): Promise<void> {
  const r = getRedis();
  await Promise.all([
    r.del(REDIS_KEYS.botConfig),
    r.del(REDIS_KEYS.botState),
    r.del(REDIS_KEYS.botPositions),
    r.del(REDIS_KEYS.botHistory),
    r.del(REDIS_KEYS.botCurve),
    r.del(REDIS_KEYS.botLogs),
  ]);
}
