import {
  getUserByEmail,
  verifyPassword,
  createToken,
  sanitizeUser,
} from "@/lib/auth-server";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { sanitizeEmail } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // Rate limit: 5 login attempts per 15 minutes per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(ip, "auth-login", 5, 15 * 60);
    if (!rl.allowed) {
      await logSecurityEvent({
        type: "rate_limited",
        ip,
        details: "Dépassement limite login (5/15min)",
      });
      return rateLimitResponse(rl.resetInSeconds);
    }

    const body = await request.json();
    const email = sanitizeEmail(body?.email);
    const password = body?.password;

    if (!email || !password) {
      return Response.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);
    if (!user) {
      await logSecurityEvent({
        type: "login_failed",
        email,
        ip,
        details: "Email inconnu",
      });
      return Response.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logSecurityEvent({
        type: "login_failed",
        userId: user.id,
        email: user.email,
        ip,
        details: "Mot de passe incorrect",
      });
      return Response.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    await logSecurityEvent({
      type: "login",
      userId: user.id,
      email: user.email,
      ip,
      details: `Connexion réussie (role=${user.role})`,
    });

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
