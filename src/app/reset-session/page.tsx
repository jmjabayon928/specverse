// src/app/reset-session/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetSessionPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.clear();

    // Attempt to clear cookies (client-side)
    const cookies = document.cookie.split(';')

    for (const raw of cookies) {
      const cookie = raw.replace(/^ +/, '')
      const expired = cookie.replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`)
      document.cookie = expired
    }

    // Optional: call backend to clear HttpOnly cookie
    fetch("/api/backend/auth/logout", { method: "POST" });

    // Wait a moment then redirect
    setTimeout(() => {
      router.replace("/login");
    }, 1000);
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-lg font-medium">Resetting session…</p>
    </div>
  );
}
