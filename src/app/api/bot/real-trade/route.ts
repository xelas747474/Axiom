// POST /api/bot/real-trade — execute a REAL order on Binance.
// Strict gate: admin + plan pro + rate limited. Manual trigger only.
import { requirePro } from "@/lib/auth-guard";
import { getBinanceClient } from "@/lib/binance-auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { validateSymbol, validateTradeAmount } from "@/lib/validation";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

interface TradeBody {
  action?: string;
  symbol?: string;
  quantity?: number;
  type?: string;
}

export async function POST(request: Request) {
  const { user, error } = await requirePro(request);
  if (error) return error;

  const ip = getClientIp(request);
  const rl = await rateLimit(user!.id, "real-trade", 5, 60);
  if (!rl.allowed) {
    await logSecurityEvent({
      type: "rate_limited",
      userId: user!.id,
      email: user!.email,
      ip,
      details: "Dépassement limite trading réel (5/min)",
    });
    return rateLimitResponse(rl.resetInSeconds);
  }

  try {
    const body = (await request.json()) as TradeBody;
    const action = body.action === "buy" ? "BUY" : body.action === "sell" ? "SELL" : null;
    const symbol = validateSymbol(body.symbol);
    const type = body.type === "MARKET" ? "MARKET" : null;
    const quantity = body.quantity;

    if (!action || !symbol || !type) {
      return Response.json({ error: "Paramètres invalides" }, { status: 400 });
    }
    if (!validateTradeAmount(quantity, 100)) {
      return Response.json({ error: "Quantité invalide" }, { status: 400 });
    }

    const client = await getBinanceClient(user!.id);
    const result = await client.post<unknown>("/api/v3/order", {
      symbol,
      side: action,
      type,
      quantity: quantity!,
    });

    await logSecurityEvent({
      type: "real_trade",
      userId: user!.id,
      email: user!.email,
      ip,
      details: `${action} ${quantity} ${symbol} (${type}) — OK`,
    });

    return Response.json({ success: true, order: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    await logSecurityEvent({
      type: "real_trade",
      userId: user!.id,
      email: user!.email,
      ip,
      details: `Échec trade réel — ${msg}`,
    });
    return Response.json({ error: msg }, { status: 500 });
  }
}
