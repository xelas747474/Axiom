// GET /api/binance/status — does the current user have stored Binance keys?
import { requireAuth } from "@/lib/auth-guard";
import { hasBinanceKeys } from "@/lib/binance-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const plan = (user as unknown as { plan?: string }).plan ?? "free";
  const configured = plan === "pro" ? await hasBinanceKeys(user!.id) : false;

  return Response.json({
    plan,
    isPro: plan === "pro",
    keysConfigured: configured,
  });
}
