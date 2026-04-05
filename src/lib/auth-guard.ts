// ============================================
// Auth guard — ergonomic wrappers over authenticateRequest
// Use in API routes that need auth/admin/pro
// ============================================

import { NextResponse } from "next/server";
import { authenticateRequest, type StoredUser } from "./auth-server";

export interface GuardResult {
  error: NextResponse | null;
  user: StoredUser | null;
}

export async function requireAuth(request: Request): Promise<GuardResult> {
  const user = await authenticateRequest(request);
  if (!user) {
    return {
      error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }),
      user: null,
    };
  }
  return { error: null, user };
}

export async function requireAdmin(request: Request): Promise<GuardResult> {
  const { user, error } = await requireAuth(request);
  if (error) return { error, user: null };
  if (user!.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * Pro plan gate — requires admin AND plan === "pro".
 * Reads plan from the extended user profile (stored in Redis under axiom:user:{id}).
 */
export async function requirePro(request: Request): Promise<GuardResult> {
  const { user, error } = await requireAdmin(request);
  if (error) return { error, user: null };
  const plan = (user as unknown as { plan?: string }).plan ?? "free";
  if (plan !== "pro") {
    return {
      error: NextResponse.json(
        { error: "Fonctionnalité réservée au plan Pro" },
        { status: 403 }
      ),
      user: null,
    };
  }
  return { error: null, user };
}
