"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetSessionPage() {
  const router = useRouter();

  useEffect(() => {
    // 🚫 Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.clear();

    // 🚫 Attempt to clear cookies (client-side)
    document.cookie.split(";").forEach(cookie => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });

    // ✅ Optional: call backend to clear HttpOnly cookie
    fetch("/api/backend/auth/logout", { method: "POST" });

    // ⏳ Wait a moment then redirect
    setTimeout(() => {
      router.replace("/login");
    }, 1000);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-lg font-medium">Resetting session…</p>
    </div>
  );
}
