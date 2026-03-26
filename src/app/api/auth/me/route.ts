import { authenticateRequest, sanitizeUser } from "@/lib/auth-server";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return Response.json({ error: "Non authentifié" }, { status: 401 });
    }

    return Response.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Auth check error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
