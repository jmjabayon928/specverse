"use client";

import { useSession } from "@/hooks/useSession";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import SupervisorDashboard from "@/components/dashboard/SupervisorDashboard";
import EngineerDashboard from "@/components/dashboard/EngineerDashboard";
import ViewerDashboard from "@/components/dashboard/ViewerDashboard";

export default function HomePage() {
  const { user } = useSession();

  if (!user) return <div className="text-center p-6">Loading...</div>;

  switch (user.role?.toLowerCase()) {
    case "admin":
      return <AdminDashboard />;
    case "supervisor":
      return <SupervisorDashboard />;
    case "engineer":
      return <EngineerDashboard />;
    case "viewer":
      return <ViewerDashboard />;
    default:
      return (
        <div className="text-red-600 p-6">
          Unknown role: {user.role}. Please contact system administrator.
        </div>
      );
  }
}
