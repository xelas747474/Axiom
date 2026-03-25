import { authenticateRequest } from "@/lib/auth-server";
import { loadCurveRedis } from "@/lib/bot/redis-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const curve = await loadCurveRedis();
    return Response.json({ curve });
  } catch (err) {
    console.error("Bot portfolio error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
