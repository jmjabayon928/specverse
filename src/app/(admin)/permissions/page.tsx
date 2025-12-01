// src/app/(admin)/permissions/page.tsx
'use client';

import { useEffect, useState } from 'react';

type Permission = {
  PermissionID: number;
  PermissionKey: string;
};

type RolePermissionsMap = {
  [role: string]: string[];
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>({});

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await fetch('/api/backend/permissions/all', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setPermissions(data);
        } else if (Array.isArray(data.permissions)) {
          setPermissions(data.permissions);
        } else {
          console.warn("⚠️ Unexpected response for permissions:", data);
        }
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
      }
    };

    const fetchRolePermissions = async () => {
      try {
        const res = await fetch('/api/backend/permissions/by-role', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await res.json();
        if (data && typeof data === 'object') {
          setRolePermissions(data);
        } else {
          console.warn("⚠️ Unexpected response for role permissions:", data);
        }
      } catch (err) {
        console.error('Failed to fetch role permissions:', err);
      }
    };

    fetchPermissions();
    fetchRolePermissions();
  }, []);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Permissions Overview</h1>

      <div>
        <h2 className="text-xl font-semibold mb-2">🔑 All Permissions</h2>
        <div className="overflow-x-auto border rounded bg-white">
          <table className="min-w-full table-auto text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Permission Key</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr key={p.PermissionID} className="border-t">
                  <td className="px-4 py-2">{p.PermissionID}</td>
                  <td className="px-4 py-2 font-mono">{p.PermissionKey}</td>
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-gray-500 text-center">
                    No permissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">👥 Permissions Per Role</h2>
        {Object.keys(rolePermissions).map((role) => (
          <div key={role} className="mb-4">
            <h3 className="font-bold text-lg mb-1">{role}</h3>
            <ul className="list-disc pl-6 text-sm text-gray-700">
              {rolePermissions[role].map((perm) => (
                <li key={`${role}:${perm}`} className="font-mono">
                  {perm}
                </li>
              ))}
              {rolePermissions[role].length === 0 && (
                <li className="text-gray-400 italic">No permissions assigned.</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
