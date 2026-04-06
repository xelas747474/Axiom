import { getDashboardData } from "@/lib/dashboard-data";
import DashboardClient from "./DashboardClient";

export const revalidate = 15;

export default async function DashboardPage() {
  let initialData = null;
  try {
    initialData = await getDashboardData();
  } catch {
    // Client will fetch on mount via fallback
  }

  return <DashboardClient initialData={initialData} />;
}
