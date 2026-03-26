import { authenticateRequest } from "@/lib/auth-server";
import { loadConfigRedis, saveConfigRedis } from "@/lib/bot/redis-storage";

export const dynamic = "force-dynamic";

// GET config
export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const config = await loadConfigRedis();
    return Response.json({ config });
  } catch (err) {
    console.error("Bot config get error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT update config
export async function PUT(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const body = await request.json();
    const currentConfig = await loadConfigRedis();
    const updated = { ...currentConfig, ...body };
    await saveConfigRedis(updated);
    return Response.json({ config: updated });
  } catch (err) {
    console.error("Bot config update error:", err);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
