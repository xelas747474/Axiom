import { authenticateRequest } from "@/lib/auth-server";
import { loadLogsRedis } from "@/lib/bot/redis-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const logs = await loadLogsRedis();
    return Response.json({ logs });
  } catch (err) {
    console.error("Bot logs error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
