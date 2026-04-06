// POST /api/binance/save-keys — admin + pro only
// Encrypts Binance API keys before storing in Redis.
import { requirePro } from "@/lib/auth-guard";
import { encrypt } from "@/lib/crypto";
import { getRedis, REDIS_KEYS } from "@/lib/redis";
import { validateBinanceKey } from "@/lib/validation";
import { logSecurityEvent } from "@/lib/security-log";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, error } = await requirePro(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { apiKey, apiSecret } = body as { apiKey?: string; apiSecret?: string };

    if (!validateBinanceKey(apiKey) || !validateBinanceKey(apiSecret)) {
      return Response.json(
        { error: "Format de clé invalide (alphanumérique, 40-128 caractères)" },
        { status: 400 }
      );
    }

    const encryptedKey = encrypt(apiKey!.trim());
    const encryptedSecret = encrypt(apiSecret!.trim());

    await getRedis().set(
      REDIS_KEYS.binanceKeys(user!.id),
      JSON.stringify({ encryptedKey, encryptedSecret, savedAt: new Date().toISOString() })
    );

    await logSecurityEvent({
      type: "api_key_save",
      userId: user!.id,
      email: user!.email,
      ip: getClientIp(request),
      details: "Clés Binance chiffrées et sauvegardées",
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("[binance/save-keys] error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
