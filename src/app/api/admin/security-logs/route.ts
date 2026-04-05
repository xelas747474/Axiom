// GET /api/admin/security-logs — admin-only, returns most recent security events.
import { requireAdmin } from "@/lib/auth-guard";
import { getSecurityLogs } from "@/lib/security-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const logs = await getSecurityLogs(200);
  return Response.json({ logs });
}
