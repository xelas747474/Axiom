import { authenticateRequest } from "@/lib/auth-server";
import { loadHistoryRedis } from "@/lib/bot/redis-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const history = await loadHistoryRedis();
    return Response.json({ history });
  } catch (err) {
    console.error("Bot history error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
