import {
  getUserByEmail,
  verifyPassword,
  createToken,
  sanitizeUser,
} from "@/lib/auth-server";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit: 5 login attempts per minute per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(ip, "auth-login", 5, 60);
    if (!rl.allowed) return rateLimitResponse(rl.resetInSeconds);

    const body = await request.json();
    const { email, password } = body;

    if (!email?.trim() || !password) {
      return Response.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return Response.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return Response.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = Response.json({
      user: sanitizeUser(user),
      token,
    });

    response.headers.set(
      "Set-Cookie",
      `axiom_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
    );

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return Response.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
