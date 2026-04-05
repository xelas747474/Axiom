// GET /api/binance/balance — returns USDT/BTC/ETH/SOL balances for the Pro admin.
import { requirePro } from "@/lib/auth-guard";
import { getBinanceClient } from "@/lib/binance-auth";
import { logSecurityEvent } from "@/lib/security-log";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}
interface BinanceAccount {
  balances: BinanceBalance[];
}

const TRACKED = new Set(["USDT", "BTC", "ETH", "SOL"]);

export async function GET(request: Request) {
  const { user, error } = await requirePro(request);
  if (error) return error;

  try {
    const client = await getBinanceClient(user!.id);
    const account = await client.get<BinanceAccount>("/api/v3/account");

    const balances = account.balances
      .filter(b => TRACKED.has(b.asset))
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));

    await logSecurityEvent({
      type: "api_key_access",
      userId: user!.id,
      email: user!.email,
      ip: getClientIp(request),
      details: "Lecture solde Binance",
    });

    return Response.json({ balances });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return Response.json({ error: msg }, { status: 400 });
  }
}
