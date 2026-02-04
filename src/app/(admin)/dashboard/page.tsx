import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from '@/components/security/SecurePage';
import { PERMISSIONS } from '@/constants/permissions';
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await requireAuth(); // ensures authentication

  return (
    <SecurePage requiredPermission={PERMISSIONS.DASHBOARD_VIEW}>
      <DashboardClient user={user} />
    </SecurePage>
  );
}