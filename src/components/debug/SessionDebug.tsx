"use client";

import React from "react";
import { useSession } from "@/hooks/useSession";

export default function SessionDebug() {
  const { user } = useSession();

  if (process.env.NODE_ENV === "production" || !user) return null;

  return (
    <div className="text-xs text-gray-400 fixed bottom-2 right-2 z-[9999] bg-black/70 text-white px-3 py-2 rounded shadow">
      <div>UserID: {user.userId}</div>
      <div>Name: {user.name}</div>
      <div>RoleID: {user.roleId}</div>
    </div>
  );
}
