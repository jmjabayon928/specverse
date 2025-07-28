import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from '@/components/security/SecurePage';
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await requireAuth(); // ensures authentication

  return (
    <SecurePage requiredPermission="DASHBOARD_VIEW">
      <DashboardClient user={user} />
    </SecurePage>
  );
}