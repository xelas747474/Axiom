import { getRedis, REDIS_KEYS } from "./redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Simple sliding window rate limiter using Redis.
 * @param ip - Client IP address
 * @param route - Route identifier (e.g., "auth", "bot")
 * @param maxRequests - Maximum requests per window
 * @param windowSeconds - Window duration in seconds
 */
export async function rateLimit(
  ip: string,
  route: string,
  maxRequests: number = 10,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  try {
    const r = getRedis();
    const key = REDIS_KEYS.rateLimit(ip, route);

    const current = await r.incr(key);

    // Set TTL on first request
    if (current === 1) {
      await r.expire(key, windowSeconds);
    }

    const ttl = await r.ttl(key);

    if (current > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - current,
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    // If Redis fails, allow the request (fail open)
    return { allowed: true, remaining: maxRequests, resetInSeconds: windowSeconds };
  }
}

/**
 * Get client IP from request headers (Vercel specific).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Helper to return rate limit error response.
 */
export function rateLimitResponse(resetInSeconds: number): Response {
  return Response.json(
    { error: "Trop de requêtes. Réessayez dans quelques instants." },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetInSeconds),
      },
    },
  );
}
