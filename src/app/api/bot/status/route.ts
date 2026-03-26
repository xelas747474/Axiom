import { authenticateRequest } from "@/lib/auth-server";
import { loadConfigRedis, loadStateRedis, loadPositionsRedis } from "@/lib/bot/redis-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const [config, state, positions] = await Promise.all([
      loadConfigRedis(),
      loadStateRedis(),
      loadPositionsRedis(),
    ]);

    return Response.json({ config, state, positions });
  } catch (err) {
    console.error("Bot status error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
