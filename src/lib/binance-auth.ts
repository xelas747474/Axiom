// ============================================
// Authenticated Binance client — signs requests with HMAC-SHA256
// Keys are loaded from Redis, decrypted on every call (never cached in memory).
// ============================================

import crypto from "crypto";
import { decrypt } from "./crypto";
import { getRedis, REDIS_KEYS } from "./redis";

export interface StoredBinanceKeys {
  encryptedKey: string;
  encryptedSecret: string;
  savedAt: string;
}

const BINANCE_BASE = "https://api.binance.com";

export interface BinanceClient {
  apiKey: string;
  sign(params: Record<string, string | number>): string;
  get<T = unknown>(endpoint: string, params?: Record<string, string | number>): Promise<T>;
  post<T = unknown>(endpoint: string, params?: Record<string, string | number>): Promise<T>;
}

export async function getBinanceClient(userId: string): Promise<BinanceClient> {
  const r = getRedis();
  const stored = await r.get<StoredBinanceKeys>(REDIS_KEYS.binanceKeys(userId));
  if (!stored) throw new Error("Clés Binance non configurées");

  const apiKey = decrypt(stored.encryptedKey);
  const apiSecret = decrypt(stored.encryptedSecret);

  function sign(params: Record<string, string | number>): string {
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    const signature = crypto.createHmac("sha256", apiSecret).update(query).digest("hex");
    return `${query}&signature=${signature}`;
  }

  async function get<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const p = { ...params, timestamp: Date.now(), recvWindow: 5000 };
    const signedQuery = sign(p);
    const res = await fetch(`${BINANCE_BASE}${endpoint}?${signedQuery}`, {
      headers: { "X-MBX-APIKEY": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { msg?: string }).msg || `Binance API error ${res.status}`);
    }
    return res.json();
  }

  async function post<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const p = { ...params, timestamp: Date.now(), recvWindow: 5000 };
    const signedQuery = sign(p);
    const res = await fetch(`${BINANCE_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: signedQuery,
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { msg?: string }).msg || `Binance order error ${res.status}`);
    }
    return res.json();
  }

  return { apiKey, sign, get, post };
}

export async function hasBinanceKeys(userId: string): Promise<boolean> {
  try {
    const r = getRedis();
    const stored = await r.get<StoredBinanceKeys>(REDIS_KEYS.binanceKeys(userId));
    return stored !== null && !!stored.encryptedKey;
  } catch {
    return false;
  }
}
