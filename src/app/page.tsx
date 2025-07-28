// src/app/page.tsx
import React from "react";
import getUserSession from "@/utils/sessionUtils.server";
import DashboardClient from "@/app/(admin)/dashboard/DashboardClient";

export default async function HomePage() {
  const user = await getUserSession();

  if (!user) {
    return <div className="p-4">Please log in to view your dashboard.</div>;
  }

  const role = user.role;

  // If Viewer, show a placeholder or limited access notice
  if (role === "Viewer") {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Welcome to SpecVerse</h1>
        <p className="text-gray-700">
          You are logged in as a Viewer. Dashboard charts are not available for your role.
        </p>
      </div>
    );
  }

  return <DashboardClient user={user} />;
}
