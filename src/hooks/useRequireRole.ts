// src/hooks/useRequireRole.ts
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";

export function useRequireRole(allowedRoles: string[]) {
  const router = useRouter();
  const { user } = useSession();
  const userRole = user?.role?.toLowerCase();

  useEffect(() => {
    if (!userRole || !allowedRoles.includes(userRole)) {
      router.push("/unauthorized");
    }
  }, [userRole, allowedRoles, router]);

  return allowedRoles.includes(userRole ?? "");
}
