import { getDashboardData } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDashboardData();
  return Response.json(data);
}
