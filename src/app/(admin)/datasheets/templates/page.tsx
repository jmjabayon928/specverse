"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic'; 
const Select = dynamic(() => import('react-select'), { ssr: false });
import Link from "next/link";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import SecurePage from '@/components/security/SecurePage';
import { useSession } from "@/hooks/useSession";
import TemplateActions from "@/components/datasheets/templates/TemplateActions";

type TemplateRow = {
  sheetId: number;
  sheetName: string;
  sheetDesc?: string;
  categoryId: number;
  categoryName: string;
  preparedById: number;
  preparedByName: string;
  revisionDate: string;
  status: string;
};

type CategoryOption = {
  CategoryID: number;
  CategoryName: string;
};

type UserOption = {
  UserID: number;
  FirstName: string;
  LastName: string;
};

type Option = { value: number; label: string };

export default function TemplateListPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [filtered, setFiltered] = useState<TemplateRow[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);

  const [categoryFilter, setCategoryFilter] = useState<Option | null>(null);
  const [userFilter, setUserFilter] = useState<Option | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const { user } = useSession();
  const [loading, setLoading] = useState(true);

  console.log("Loaded templates:", filtered);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/backend/templates/reference-options", {
          credentials: "include",
        });
        const data = await res.json();
        if (Array.isArray(data.categories)) {
          setCategories(
            data.categories.map((c: CategoryOption) => ({
              value: c.CategoryID,
              label: c.CategoryName,
            }))
          );
        } else {
          console.warn("No categories found in response:", data);
          setCategories([]);
        }
        if (Array.isArray(data.users)) {
        setUsers(
            data.users.map((u: UserOption) => ({
              value: u.UserID,
              label: `${u.FirstName} ${u.LastName}`,
            }))
          );
        } else {
          console.warn("No users found in response:", data);
          setUsers([]);
        }
      } catch (err) {
        console.error("Failed to fetch reference options", err);
      }
    };

    const fetchTemplates = async () => {
      setLoading(true); 
      try {
        const res = await fetch("http://localhost:5000/api/backend/templates", {
          credentials: "include",
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setTemplates(data);
          setFiltered(data);
        } else {
          console.warn("Templates fetch returned non-array:", data);
          setTemplates([]);
          setFiltered([]);
        }
      } catch (err) {
        console.error("Failed to fetch templates", err);
      } finally {
        setLoading(false); 
      }
    };

    fetchOptions();
    fetchTemplates();
  }, []);

  useEffect(() => {
    let temp = [...templates];
    if (categoryFilter) {
      temp = temp.filter(t => t.categoryId === categoryFilter.value);
    }
    if (userFilter) {
      temp = temp.filter(t => t.preparedById === userFilter.value);
    }
    if (dateFrom) {
      temp = temp.filter(t => new Date(t.revisionDate) >= dateFrom);
    }
    if (dateTo) {
      temp = temp.filter(t => new Date(t.revisionDate) <= dateTo);
    }
    setFiltered(temp);
  }, [categoryFilter, userFilter, dateFrom, dateTo, templates]);

  return (
    <SecurePage requiredPermission="TEMPLATES_VIEW">
      {loading ? (
        <p className="text-center text-gray-500 py-4">Loading templates...</p>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Datasheet Templates</h1>
            <Link href="/datasheets/templates/create" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              + New Template
            </Link>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              options={categories}
              value={categoryFilter}
              onChange={(newValue) => setCategoryFilter(newValue as Option | null)}
              placeholder="Filter by Category"
              isClearable
            />
            <Select
              options={users}
              value={userFilter}
              onChange={(newValue) => setUserFilter(newValue as Option | null)}
              placeholder="Filter by Prepared By"
              isClearable
            />
            <DatePicker selected={dateFrom} onChange={setDateFrom} placeholderText="From Date" className="w-full border px-3 py-2 rounded" />
            <DatePicker selected={dateTo} onChange={setDateTo} placeholderText="To Date" className="w-full border px-3 py-2 rounded" />
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full table-auto text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">📄 Template Name</th>
                  <th className="px-4 py-2">📝 Description</th>
                  <th className="px-4 py-2">🏷 Category</th>
                  <th className="px-4 py-2">👤 Prepared By</th>
                  <th className="px-4 py-2">🗓 Revision Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.sheetId} className="border-t">
                    <td className="px-4 py-2 text-blue-600 hover:underline">
                      <a href={`/datasheets/templates/${t.sheetId}`}>{t.sheetName}</a>
                    </td>
                    <td className="px-4 py-2">{t.sheetDesc || '-'}</td>
                    <td className="px-4 py-2">{t.categoryName || '-'}</td>
                    <td className="px-4 py-2">{t.preparedByName || '-'}</td>
                    <td className="px-4 py-2">{t.revisionDate ? format(new Date(t.revisionDate), 'MMM dd, yyyy') : '-'}</td>
                    <td className="px-4 py-2 capitalize">{t.status}</td>
                    <td className="px-4 py-2 space-x-2">
                      {user ? (
                        <TemplateActions
                          template={{
                            sheetId: t.sheetId ?? 0,
                            preparedBy: t.preparedById ?? 0, 
                            status: (t.status ?? "Draft") as "Draft" | "Rejected" | "Modified Draft" | "Verified" | "Approved",
                            isTemplate: true,
                          }}
                          user={user}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-500">No templates found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SecurePage>
  );
}
