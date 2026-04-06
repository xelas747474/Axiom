import { Redis } from "@upstash/redis";

// Singleton Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing KV_REST_API_URL or KV_REST_API_TOKEN environment variables. " +
        "Please configure Upstash Redis via Vercel Storage."
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

// Helper: check connection
export async function testRedisConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    const r = getRedis();
    await r.set("axiom:ping", "pong");
    const result = await r.get("axiom:ping");
    const latencyMs = Date.now() - start;

    if (result !== "pong") {
      return { ok: false, latencyMs, error: "Unexpected value returned" };
    }

    await r.del("axiom:ping");
    return { ok: true, latencyMs };
  } catch (err) {
    return {
      ok: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Redis key prefixes for the app
export const REDIS_KEYS = {
  // Auth
  user: (id: string) => `axiom:user:${id}`,
  userByEmail: (email: string) => `axiom:user:email:${email}`,
  usersList: "axiom:users",

  // Bot
  botConfig: "axiom:bot:config",
  botState: "axiom:bot:state",
  botPositions: "axiom:bot:positions",
  botHistory: "axiom:bot:history",
  botCurve: "axiom:bot:curve",
  botLogs: "axiom:bot:logs",

  // Rate limiting
  rateLimit: (ip: string, route: string) => `axiom:rate:${route}:${ip}`,

  // Binance (encrypted API keys per user)
  binanceKeys: (userId: string) => `axiom:binance:keys:${userId}`,
  binanceMode: (userId: string) => `axiom:binance:mode:${userId}`,

  // Security audit log
  securityLogs: "axiom:security:logs",
} as const;
