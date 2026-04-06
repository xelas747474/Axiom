// POST /api/binance/test-connection — verifies stored keys against Binance account endpoint.
import { requirePro } from "@/lib/auth-guard";
import { getBinanceClient } from "@/lib/binance-auth";
import { logSecurityEvent } from "@/lib/security-log";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface BinanceAccount {
  canTrade: boolean;
  canWithdraw: boolean;
  accountType: string;
}

export async function POST(request: Request) {
  const { user, error } = await requirePro(request);
  if (error) return error;

  try {
    const client = await getBinanceClient(user!.id);
    const account = await client.get<BinanceAccount>("/api/v3/account");

    await logSecurityEvent({
      type: "api_key_access",
      userId: user!.id,
      email: user!.email,
      ip: getClientIp(request),
      details: `Test connexion OK — canTrade=${account.canTrade} canWithdraw=${account.canWithdraw}`,
    });

    return Response.json({
      connected: true,
      canTrade: account.canTrade,
      canWithdraw: account.canWithdraw,
      accountType: account.accountType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Binance";
    await logSecurityEvent({
      type: "api_key_access",
      userId: user!.id,
      email: user!.email,
      ip: getClientIp(request),
      details: `Test connexion ÉCHEC — ${msg}`,
    });
    return Response.json({ connected: false, error: msg }, { status: 400 });
  }
}
