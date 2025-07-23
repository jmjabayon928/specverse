import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserSession } from "@/types/session"; 

// ✅ Add return type annotation here
export function useSession(): { user: UserSession | null; loading: boolean } {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const isLoginPage = pathname === "/login";

    if (!isLoginPage) {
      (async () => {
        try {
          const res = await fetch("/api/backend/auth/session", {
            credentials: "include",
          });

          console.log("🛰️ Session fetch response status:", res.status);

          if (res.status === 304) {
            console.log("📦 Session not modified (304), using cached session");
            return;
          }

          if (!res.ok) {
            console.warn("No active session. Status:", res.status);
            setUser(null);
            setLoading(false);
            return;
          }

          const data: UserSession = await res.json(); // ✅ Cast properly
		  /*
          if (process.env.NODE_ENV !== "production") {
            console.log("✅ User session from /auth/session:", data);
          }
          console.log("🌐 [Frontend] Session response data:", data);
          console.log("📦 Decoded session (frontend):", data);
		  */
          setUser(data);
        } catch (err) {
          console.error("❌ Failed to load session:", err);
          setUser(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [pathname]);

  return { user, loading };
}
