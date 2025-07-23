// src/utils/requireSession.ts

export async function requireSession(): Promise<{
  id: number;
  role: string;
  permissions: string[];
}> {
  try {
    const res = await fetch("/api/backend/auth/session", {
      method: "GET",
      credentials: "include", // ✅ Ensure cookies are sent
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error("Not authenticated");
    }

    const user = await res.json();

    if (!user || typeof user.userId !== "number" || !user.role) {
      throw new Error("Invalid session data");
    }

    return {
      id: user.userId,
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error("Failed to fetch session: " + err.message);
    }
    throw new Error("Failed to fetch session: Unknown error");
  }
}
