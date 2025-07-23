// src/frontend/api/authApi.ts
export async function login(username: string, password: string) {
  const res = await fetch(`/api/backend/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function logout() {
  const res = await fetch(`/api/backend/auth/logout`, { method: "POST" });
  if (!res.ok) throw new Error("Logout failed");
  return res.json();
}

export async function getCurrentSession() {
  const res = await fetch(`/api/backend/auth/session`);
  if (!res.ok) throw new Error("Failed to get session");
  return res.json();
}
