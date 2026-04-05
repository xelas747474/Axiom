import { createUser, createToken, sanitizeUser } from "@/lib/auth-server";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { sanitizeEmail, sanitizeString, validatePassword } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // Rate limit: 3 signup attempts per hour per IP
    const ip = getClientIp(request);
    const rl = await rateLimit(ip, "auth-signup", 3, 60 * 60);
    if (!rl.allowed) {
      await logSecurityEvent({
        type: "rate_limited",
        ip,
        details: "Dépassement limite signup (3/h)",
      });
      return rateLimitResponse(rl.resetInSeconds);
    }

    const body = await request.json();
    const name = sanitizeString(body?.name, 60);
    const email = sanitizeEmail(body?.email);
    const password = body?.password;

    if (!name || !email || !password) {
      return Response.json(
        { error: "Nom, email et mot de passe requis" },
        { status: 400 }
      );
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return Response.json({ error: pwdCheck.error }, { status: 400 });
    }

    const result = await createUser(name, email, password);

    if (!result.ok || !result.user) {
      return Response.json(
        { error: result.error || "Erreur lors de la création" },
        { status: 409 }
      );
    }

    await logSecurityEvent({
      type: "signup",
      userId: result.user.id,
      email: result.user.email,
      ip,
      details: `Nouveau compte (role=${result.user.role}, plan=${result.user.plan})`,
    });

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
