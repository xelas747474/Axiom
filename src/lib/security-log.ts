// ============================================
// Security event log — stored in Redis (ring buffer, last 1000)
// Visible in /admin for audit purposes.
// ============================================

import { getRedis } from "./redis";

export type SecurityEventType =
  | "login"
  | "login_failed"
  | "signup"
  | "logout"
  | "admin_action"
  | "real_trade"
  | "api_key_save"
  | "api_key_access"
  | "rate_limited"
  | "unauthorized"
  | "suspicious";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
  details: string;
  timestamp: string;
}

const REDIS_KEY = "axiom:security:logs";
const MAX_LOGS = 1000;

export async function logSecurityEvent(
  event: Omit<SecurityEvent, "timestamp">
): Promise<void> {
  try {
    const r = getRedis();
    const entry: SecurityEvent = { ...event, timestamp: new Date().toISOString() };
    const existing = (await r.get<SecurityEvent[]>(REDIS_KEY)) ?? [];
    existing.push(entry);
    if (existing.length > MAX_LOGS) existing.splice(0, existing.length - MAX_LOGS);
    await r.set(REDIS_KEY, JSON.stringify(existing));
  } catch (err) {
    // Never let logging failures break the request path
    console.error("[security-log] failed:", err);
  }
}

export async function getSecurityLogs(limit = 200): Promise<SecurityEvent[]> {
  try {
    const r = getRedis();
    const logs = (await r.get<SecurityEvent[]>(REDIS_KEY)) ?? [];
    return logs.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export async function clearSecurityLogs(): Promise<void> {
  try {
    await getRedis().del(REDIS_KEY);
  } catch { /* ignore */ }
}
