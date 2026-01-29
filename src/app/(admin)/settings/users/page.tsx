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
      </div>

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
