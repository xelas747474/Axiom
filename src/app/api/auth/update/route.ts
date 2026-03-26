import { authenticateRequest, updateUserData, sanitizeUser } from "@/lib/auth-server";

export async function PUT(request: Request) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { name, preferences } = body;

    const updates: { name?: string; preferences?: typeof user.preferences } = {};
    if (name?.trim()) updates.name = name.trim();
    if (preferences && typeof preferences === "object") {
      updates.preferences = preferences;
    }

    const updated = await updateUserData(user.id, updates);
    if (!updated) {
      return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    return Response.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error("Update user error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
