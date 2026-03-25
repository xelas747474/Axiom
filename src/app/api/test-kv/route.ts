import { testRedisConnection, getRedis, REDIS_KEYS } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Test basic connection
    const connectionTest = await testRedisConnection();

    if (!connectionTest.ok) {
      return Response.json(
        {
          status: "error",
          message: "Redis connection failed",
          error: connectionTest.error,
        },
        { status: 500 }
      );
    }

    // Test read/write with a real key
    const r = getRedis();
    const testKey = "axiom:test:phase0";
    const testValue = { timestamp: Date.now(), message: "Phase 0 OK" };

    await r.set(testKey, JSON.stringify(testValue), { ex: 60 }); // expires in 60s
    const stored = await r.get<string>(testKey);
    await r.del(testKey);

    // Check key prefix listing
    const keysInfo = {
      userPrefix: REDIS_KEYS.user("example"),
      botConfigKey: REDIS_KEYS.botConfig,
      rateLimitPrefix: REDIS_KEYS.rateLimit("127.0.0.1", "auth"),
    };

    return Response.json({
      status: "ok",
      message: "Upstash Redis connection successful!",
      latencyMs: connectionTest.latencyMs,
      testWrite: stored ? JSON.parse(stored) : null,
      keyStructure: keysInfo,
      env: {
        KV_REST_API_URL: process.env.KV_REST_API_URL ? "SET" : "MISSING",
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "SET" : "MISSING",
        JWT_SECRET: process.env.JWT_SECRET ? "SET" : "MISSING",
        CRON_SECRET: process.env.CRON_SECRET ? "SET" : "MISSING",
      },
    });
  } catch (err) {
    return Response.json(
      {
        status: "error",
        message: "Unexpected error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
