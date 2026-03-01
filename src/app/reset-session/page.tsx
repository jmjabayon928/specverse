// src/app/reset-session/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetSessionPage() {
  const router = useRouter();

  useEffect(() => {
    const logout = async () => {
      try {
        await fetch("/api/backend/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Ignore errors - redirect anyway
      }
      router.replace("/login");
    };
    void logout();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-lg font-medium">Resetting session…</p>
    </div>
  );
}
