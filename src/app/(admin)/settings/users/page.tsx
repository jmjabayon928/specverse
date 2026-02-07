// src/app/(admin)/settings/users/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSession } from "@/hooks/useSession";

type UserRow = {
  UserID: number;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  RoleID: number | null;
  ProfilePic: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  RoleName?: string | null;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

type PendingInviteRow = {
  id: number;
  email: string;
  roleId: number | null;
  roleName: string | null;
  status: string;
  expiresAt: string | null;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
};

function normalizePendingInviteRow(raw: unknown): PendingInviteRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.InviteID === "number" ? o.InviteID : typeof o.inviteId === "number" ? o.inviteId : typeof o.id === "number" ? o.id : null;
  if (id === null) return null;
  const email = typeof o.Email === "string" ? o.Email : typeof o.email === "string" ? o.email : "";
  const roleId = typeof o.RoleID === "number" ? o.RoleID : typeof o.roleId === "number" ? o.roleId : null;
  const roleName = typeof o.RoleName === "string" ? o.RoleName : typeof o.roleName === "string" ? o.roleName : null;
  const status = typeof o.Status === "string" ? o.Status : typeof o.status === "string" ? o.status : "Pending";
  const expiresAt = typeof o.ExpiresAt === "string" ? o.ExpiresAt : typeof o.expiresAt === "string" ? o.expiresAt : null;
  const sendCount = typeof o.SendCount === "number" ? o.SendCount : typeof o.sendCount === "number" ? o.sendCount : 0;
  const lastSentAt = typeof o.LastSentAt === "string" ? o.LastSentAt : typeof o.lastSentAt === "string" ? o.lastSentAt : null;
  const createdAt = typeof o.CreatedAt === "string" ? o.CreatedAt : typeof o.createdAt === "string" ? o.createdAt : "";
  return { id, email, roleId, roleName, status, expiresAt, sendCount, lastSentAt, createdAt };
}

function normalizePendingInvitesResponse(data: unknown): PendingInviteRow[] {
  if (Array.isArray(data)) {
    const out: PendingInviteRow[] = [];
    for (const item of data) {
      const n = normalizePendingInviteRow(item);
      if (n) out.push(n);
    }
    return out;
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const arr = obj.rows ?? obj.invites;
    if (Array.isArray(arr)) {
      const out: PendingInviteRow[] = [];
      for (const item of arr) {
        const n = normalizePendingInviteRow(item);
        if (n) out.push(n);
      }
      return out;
    }
  }
  return [];
}

const isProd = process.env.NODE_ENV === "production";

export default function UsersPage() {
  const { user } = useSession();
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // Keep latest search without forcing the effect to depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
          search: q,
        });
        const r = await fetch(
          `/api/backend/settings/users?${qs.toString()}`,
          { credentials: "include" }
        );
        if (!r.ok) {
          setRows([]);
          setTotal(0);
          return;
        }
        const j: Paged<UserRow> = await r.json();
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTotal(j.total ?? 0);
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load on page/pageSize changes (search only when user clicks Search)
  useEffect(() => {
    void load(page, pageSize, searchRef.current);
  }, [page, pageSize, load]);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRow | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoles, setInviteRoles] = useState<RoleOption[]>([]);
  const [inviteRolesLoading, setInviteRolesLoading] = useState(false);
  const [inviteRolesError, setInviteRolesError] = useState<string | null>(null);
  const inviteRolesLoadedRef = useRef(false);
  const inviteRolesInFlightRef = useRef(false);

  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
  const [pendingInvitesError, setPendingInvitesError] = useState<string | null>(null);
  const pendingInvitesInFlightRef = useRef(false);
  const pendingInvitesFetchedForUserIdRef = useRef<number | null>(null);

  const fetchPendingInvites = useCallback(() => {
    if (pendingInvitesInFlightRef.current) return;
    pendingInvitesInFlightRef.current = true;
    setPendingInvitesLoading(true);
    setPendingInvitesError(null);
    const url = `/api/backend/invites?ts=${Date.now()}`;
    fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
      .then(async (r) => {
        if (r.status === 304) {
          return;
        }
        const j = await r.json().catch(() => ({} as Record<string, unknown>));
        if (!r.ok) {
          const msg = (j as { error?: string; message?: string }).error ?? (j as { error?: string; message?: string }).message ?? "Failed to load invites";
          setPendingInvitesError(String(msg));
          toast.error(String(msg));
          setPendingInvites([]);
          return;
        }
        setPendingInvites(normalizePendingInvitesResponse(j));
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load invites";
        setPendingInvitesError(msg);
        toast.error(msg);
        setPendingInvites([]);
      })
      .finally(() => {
        pendingInvitesInFlightRef.current = false;
        setPendingInvitesLoading(false);
      });
  }, []);

  const resendInvite = useCallback(
    (inviteId: number) => {
      if (pendingInvitesLoading) return;
      fetch(`/api/backend/invites/${inviteId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      })
        .then(async (r) => {
          const j = await r.json().catch(() => ({} as Record<string, unknown>));
          const msg = (j as { error?: string; message?: string }).error ?? (j as { error?: string; message?: string }).message;
          if (r.ok) {
            toast.success("Invite resent");
            fetchPendingInvites();
          } else {
            toast.error(msg ?? "Failed to resend invite");
          }
        })
        .catch(() => toast.error("Failed to resend invite"));
    },
    [pendingInvitesLoading, fetchPendingInvites]
  );

  const revokeInvite = useCallback(
    (inviteId: number) => {
      if (pendingInvitesLoading) return;
      if (!window.confirm("Revoke this invite?")) return;
      fetch(`/api/backend/invites/${inviteId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: "{}",
      })
        .then(async (r) => {
          const j = await r.json().catch(() => ({} as Record<string, unknown>));
          const msg = (j as { error?: string; message?: string }).error ?? (j as { error?: string; message?: string }).message;
          if (r.ok) {
            toast.success("Invite revoked");
            fetchPendingInvites();
          } else {
            toast.error(msg ?? "Failed to revoke invite");
          }
        })
        .catch(() => toast.error("Failed to revoke invite"));
    },
    [pendingInvitesLoading, fetchPendingInvites]
  );

  const copyDevAcceptLink = useCallback((inviteId: number) => {
    if (pendingInvitesLoading) return;
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      toast.error("Clipboard unavailable");
      return;
    }
    fetch(`/api/backend/invites/${inviteId}/dev-accept-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: "{}",
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({} as Record<string, unknown>));
        const msg = (j as { error?: string; message?: string }).error ?? (j as { error?: string; message?: string }).message;
        if (r.ok) {
          const acceptUrl = typeof (j as { acceptUrl?: unknown }).acceptUrl === "string" ? (j as { acceptUrl: string }).acceptUrl : "";
          if (!acceptUrl) {
            toast.error(msg ?? "Failed to copy accept link");
            return;
          }
          await navigator.clipboard.writeText(acceptUrl);
          toast.success("Accept link copied to clipboard");
        } else {
          toast.error(msg ?? "Failed to copy accept link");
        }
      })
      .catch(() => toast.error("Failed to copy accept link"));
  }, [pendingInvitesLoading]);

  useEffect(() => {
    const userId = user?.userId ?? null;
    if (userId === null) return;
    if (pendingInvitesFetchedForUserIdRef.current === userId) return;
    pendingInvitesFetchedForUserIdRef.current = userId;
    void fetchPendingInvites();
  }, [user?.userId, fetchPendingInvites]);

  const fetchInviteRoles = useCallback(() => {
    if (inviteRolesLoadedRef.current) return;
    if (inviteRolesInFlightRef.current) return;
    inviteRolesInFlightRef.current = true;
    setInviteRolesLoading(true);
    setInviteRolesError(null);
    const url = `/api/backend/roles?ts=${Date.now()}`;
    fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
      .then((r) => {
        if (r.status === 304) return null;
        if (!r.ok) throw new Error(`Roles fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        if (data === null) return;
        setInviteRoles(normalizeRolesResponse(data));
        inviteRolesLoadedRef.current = true;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load roles";
        setInviteRolesError(msg);
        toast.error(msg);
      })
      .finally(() => {
        inviteRolesInFlightRef.current = false;
        setInviteRolesLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!showInviteModal) return;
    void fetchInviteRoles();
  }, [showInviteModal, fetchInviteRoles]);

  const retryInviteRoles = useCallback(() => {
    inviteRolesLoadedRef.current = false;
    void fetchInviteRoles();
  }, [fetchInviteRoles]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="border rounded px-3 py-2"
        />
        <button
          onClick={() => {
            setPage(1);
            void load(1, pageSize, search);
          }}
          className="border rounded px-3 py-2"
        >
          Search
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="border rounded px-3 py-2"
        >
          + New User
        </button>
        <button
          onClick={() => setShowInviteModal(true)}
          className="border rounded px-3 py-2"
        >
          Invite User
        </button>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Pending Invites</h3>
          <button
            type="button"
            onClick={() => void fetchPendingInvites()}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50"
            disabled={pendingInvitesLoading}
          >
            Refresh
          </button>
        </div>
        {pendingInvitesLoading ? (
          <p className="text-sm text-slate-500">Loading pending invites…</p>
        ) : pendingInvitesError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{pendingInvitesError}</p>
            <button
              type="button"
              onClick={() => void fetchPendingInvites()}
              className="border rounded px-2 py-1 text-sm disabled:opacity-50"
              disabled={pendingInvitesLoading}
            >
              Refresh
            </button>
          </div>
        ) : pendingInvites.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invites.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Expires At</th>
                <th className="py-2">Send Count</th>
                <th className="py-2">Last Sent</th>
                <th className="py-2">Created</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((inv) => (
                <tr key={inv.id} className="border-b">
                  <td className="py-2">{inv.email}</td>
                  <td className="py-2">{inv.roleName ?? (inv.roleId != null ? `Role #${inv.roleId}` : "—")}</td>
                  <td className="py-2">{inv.status || "—"}</td>
                  <td className="py-2">{inv.expiresAt ?? "—"}</td>
                  <td className="py-2">{inv.sendCount}</td>
                  <td className="py-2">{inv.lastSentAt ?? "—"}</td>
                  <td className="py-2">{inv.createdAt || "—"}</td>
                  <td className="py-2">
                    {String(inv.status ?? "").toLowerCase() === "pending" ? (
                      <>
                        <button
                          type="button"
                          className="mr-2 underline disabled:opacity-50"
                          onClick={() => resendInvite(inv.id)}
                          disabled={pendingInvitesLoading}
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline disabled:opacity-50"
                          onClick={() => revokeInvite(inv.id)}
                          disabled={pendingInvitesLoading}
                        >
                          Revoke
                        </button>
                        {!isProd && (
                          <button
                            type="button"
                            className="ml-2 underline disabled:opacity-50"
                            onClick={() => copyDevAcceptLink(inv.id)}
                            disabled={pendingInvitesLoading}
                          >
                            Copy link
                          </button>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Active</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.UserID} className="border-b">
                <td className="py-2">{r.UserID}</td>
                <td className="py-2">
                  {[r.FirstName, r.LastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="py-2">{r.Email ?? "—"}</td>
                <td className="py-2">{r.RoleName ?? r.RoleID ?? "—"}</td>
                <td className="py-2">{r.IsActive ? "Yes" : "No"}</td>
                <td className="py-2">
                  <button
                    className="mr-2 underline"
                    onClick={() => {
                      setEditing(r);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                  {isAdmin && (
                    <button
                      className="mr-2 underline text-blue-600"
                      onClick={() => {
                        setResetPasswordUser(r);
                      }}
                    >
                      Reset Password
                    </button>
                  )}
                  <button
                    className="text-red-600 underline"
                    onClick={async () => {
                      if (!confirm("Delete this user?")) return;
                      await fetch(
                        `/api/backend/settings/users/${r.UserID}`,
                        { method: "DELETE", credentials: "include" }
                      );
                      void load(page, pageSize, searchRef.current);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="border rounded px-3 py-1"
        >
          Prev
        </button>
        <div>
          Page {page} / {totalPages}
        </div>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="border rounded px-3 py-1"
        >
          Next
        </button>
      </div>

      {showForm && (
        <UserForm
          initial={editing ?? undefined}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void load(page, pageSize, searchRef.current);
          }}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
        />
      )}

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          roles={inviteRoles}
          rolesLoading={inviteRolesLoading}
          rolesError={inviteRolesError}
          onRetryRoles={retryInviteRoles}
        />
      )}
    </div>
  );
}

type UserSubmitPayload = {
  FirstName: string;
  LastName: string;
  Email: string;
  RoleID: number | null;
  ProfilePic: string;
  IsActive: boolean;
  Password?: string;
};

function UserForm(props: Readonly<{
  initial?: Partial<UserRow>;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, onClose, onSaved } = props;

  const [FirstName, setFirstName] = useState(initial?.FirstName ?? "");
  const [LastName, setLastName] = useState(initial?.LastName ?? "");
  const [Email, setEmail] = useState(initial?.Email ?? "");
  const [RoleID, setRoleID] = useState<number | "">(initial?.RoleID ?? "");
  const [ProfilePic, setProfilePic] = useState(initial?.ProfilePic ?? "");
  const [IsActive, setIsActive] = useState(initial?.IsActive ?? true);
  const [Password, setPassword] = useState("");

  const userId = initial?.UserID ?? null;
  const isEdit = Boolean(userId);

  const submit = async () => {
    const roleValue: number | null = RoleID === "" ? null : Number(RoleID);

    const payload: UserSubmitPayload = {
      FirstName,
      LastName,
      Email,
      RoleID: roleValue,
      ProfilePic,
      IsActive,
    };

    if (Password.trim()) {
      // Allow setting a password on create or update
      payload.Password = Password;
    }

    const url = userId
      ? `/api/backend/settings/users/${userId}`
      : `/api/backend/settings/users`;
    const method = userId ? "PATCH" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({} as Record<string, unknown>));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "Save failed");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">{isEdit ? "Edit User" : "New User"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            First Name <input
              className="border rounded px-2 py-1"
              value={FirstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="flex flex-col">
            Last Name <input
              className="border rounded px-2 py-1"
              value={LastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label className="flex flex-col col-span-2">
            Email <input
              className="border rounded px-2 py-1"
              value={Email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col">
            Role ID <input
              className="border rounded px-2 py-1"
              value={RoleID}
              onChange={(e) =>
                setRoleID(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          </label>
          <label className="flex flex-col">
            Profile Pic URL <input
              className="border rounded px-2 py-1"
              value={ProfilePic}
              onChange={(e) => setProfilePic(e.target.value)}
            />
          </label>

          {!isEdit && (
            <label className="flex flex-col col-span-2">
              Password <input
                type="password"
                className="border rounded px-2 py-1"
                value={Password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {isEdit && (
            <label className="flex flex-col col-span-2">
              New Password (optional) <input
                type="password"
                className="border rounded px-2 py-1"
                value={Password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}

          <label className="flex items-center gap-2 col-span-2">
            <input
              type="checkbox"
              checked={IsActive}
              onChange={(e) => setIsActive(e.target.checked)}
            /> Active
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-3 py-2 border rounded" onClick={submit}>
            {isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

type RoleOption = { RoleID: number; RoleName: string | null };

function isPascalRole(x: unknown): x is { RoleID: number; RoleName: string | null } {
  return (
    typeof x === "object" &&
    x !== null &&
    "RoleID" in x &&
    typeof (x as { RoleID: unknown }).RoleID === "number"
  );
}

function isCamelRole(x: unknown): x is { roleId: number; roleName: string | null } {
  return (
    typeof x === "object" &&
    x !== null &&
    "roleId" in x &&
    typeof (x as { roleId: unknown }).roleId === "number"
  );
}

function normalizeRole(raw: unknown): RoleOption | null {
  if (isPascalRole(raw)) return { RoleID: raw.RoleID, RoleName: raw.RoleName ?? null };
  if (isCamelRole(raw)) return { RoleID: raw.roleId, RoleName: raw.roleName ?? null };
  return null;
}

function normalizeRolesResponse(data: unknown): RoleOption[] {
  if (Array.isArray(data)) {
    const out: RoleOption[] = [];
    for (const item of data) {
      const n = normalizeRole(item);
      if (n) out.push(n);
    }
    return out;
  }
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const arr = obj.roles ?? obj.rows ?? obj.data;
    if (Array.isArray(arr)) {
      return arr
        .map((item: unknown) => normalizeRole(item))
        .filter((n): n is RoleOption => n !== null);
    }
  }
  return [];
}

function InviteModal(props: Readonly<{
  onClose: () => void;
  roles: RoleOption[];
  rolesLoading: boolean;
  rolesError: string | null;
  onRetryRoles: () => void;
}>) {
  const { onClose, roles, rolesLoading, rolesError, onRetryRoles } = props;
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }
    const rId = roleId === "" ? null : Number(roleId);
    if (rId === null || Number.isNaN(rId)) {
      toast.error("Role is required");
      return;
    }
    setSubmitLoading(true);
    try {
      const r = await fetch("/api/backend/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: trimmedEmail, roleId: rId }),
      });
      const j = await r.json().catch(() => ({} as Record<string, unknown>));
      const serverMessage = (j as { error?: string; message?: string }).error ?? (j as { error?: string; message?: string }).message;
      const resent = (j as { resent?: boolean }).resent === true;
      if (r.status === 200 || r.status === 201) {
        toast.success(resent ? "Invite resent" : "Invite sent");
        setEmail("");
        setRoleId("");
        onClose();
        return;
      }
      toast.error(serverMessage ?? "Failed to send invite");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">Invite User</h2>
        {rolesLoading ? (
          <p className="text-sm text-slate-500">Loading roles…</p>
        ) : rolesError ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-red-600">{rolesError}</p>
            <button
              type="button"
              className="text-sm underline disabled:opacity-50"
              onClick={onRetryRoles}
              disabled={rolesLoading}
            >
              Retry
            </button>
          </div>
        ) : null}
        <div className="space-y-3">
          <label className="flex flex-col">
            Email <span className="text-red-500">*</span>
            <input
              type="email"
              className="border rounded px-2 py-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col">
            Role <span className="text-red-500">*</span>
            <select
              className="border rounded px-2 py-1"
              value={roleId === "" ? "" : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === "" ? "" : Number(e.target.value))}
              required
              disabled={rolesLoading}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.RoleID} value={role.RoleID}>
                  {role.RoleName ?? `Role ${role.RoleID}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 border rounded"
            onClick={handleSubmit}
            disabled={rolesLoading || roles.length === 0 || submitLoading}
          >
            {submitLoading ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal(props: Readonly<{
  user: UserRow;
  onClose: () => void;
}>) {
  const { user, onClose } = props;
  const [newPassword, setNewPassword] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const body: { newPassword?: string } = {};
      if (newPassword.trim()) {
        body.newPassword = newPassword.trim();
      }

      const r = await fetch(
        `/api/backend/admin/users/${user.UserID}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      const j = await r.json().catch(() => ({} as Record<string, unknown>));

      if (!r.ok) {
        const errorMsg = (j as { error?: string; message?: string }).error ?? 
                        (j as { error?: string; message?: string }).message ?? 
                        "Failed to reset password";
        toast.error(errorMsg);
        return;
      }

      const response = j as {
        userId: string;
        tempPassword?: string;
        message: string;
      };

      if (response.tempPassword) {
        setTempPassword(response.tempPassword);
      } else {
        toast.success(response.message);
        onClose();
      }
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-4">
        <h2 className="text-xl font-semibold">Reset Password</h2>
        
        {tempPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Temporary password generated. Please copy it now - it will not be shown again.
            </p>
            <div className="space-y-2">
              <label className="flex flex-col">
                <span className="text-sm font-medium">Temporary Password:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tempPassword}
                    className="border rounded px-3 py-2 flex-1 font-mono bg-gray-50"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast.success("Password copied to clipboard");
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    Copy
                  </button>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => {
                  setTempPassword(null);
                  onClose();
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reset password for <strong>{user.Email ?? `User #${user.UserID}`}</strong>
            </p>
            <div className="space-y-2">
              <label className="flex flex-col">
                <span className="text-sm font-medium">
                  New Password (leave blank to generate temporary password):
                </span>
                <input
                  type="password"
                  className="border rounded px-3 py-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border rounded"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
