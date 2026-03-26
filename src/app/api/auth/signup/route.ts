import { createUser, createToken, sanitizeUser } from "@/lib/auth-server";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit: 3 signup attempts per minute per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(ip, "auth-signup", 3, 60);
    if (!rl.allowed) return rateLimitResponse(rl.resetInSeconds);

    const body = await request.json();
    const { name, email, password } = body;

    // Validation
    if (!name?.trim() || !email?.trim() || !password) {
      return Response.json(
        { error: "Nom, email et mot de passe requis" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Format d'email invalide" }, { status: 400 });
    }

    const result = await createUser(name.trim(), email, password);

    if (!result.ok || !result.user) {
      return Response.json(
        { error: result.error || "Erreur lors de la création" },
        { status: 409 }
      );
    }

    const token = createToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    const response = Response.json({
      user: sanitizeUser(result.user),
      token,
    });

    // Set HTTP-only cookie as well
    response.headers.set(
      "Set-Cookie",
      `axiom_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    );

    return response;
  } catch (err) {
    console.error("Signup error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
