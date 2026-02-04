// src/app/(admin)/datasheets/filled/page.tsx

"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic'; 
const Select = dynamic(() => import('react-select'), { ssr: false });
import Link from "next/link";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import SecurePage from '@/components/security/SecurePage';
import { PERMISSIONS } from '@/constants/permissions';
import { useSession } from "@/hooks/useSession";
import FilledSheetActions from '@/components/datasheets/filled/FilledSheetActions';

type FilledSheetRow = {
  sheetId: number;
  sheetName: string;
  sheetDesc?: string;
  categoryId: number;
  categoryName: string;
  preparedById: number;
  preparedByName: string;
  revisionDate: string;
  status: string;
  disciplineId?: number | null;
  disciplineName?: string | null;
  subtypeId?: number | null;
  subtypeName?: string | null;
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

type Option = {
  value: number;
  label: string;
};

function disciplineSubtypeLabel(row: FilledSheetRow): string {
  const d = row.disciplineName != null && row.disciplineName !== "" ? row.disciplineName : null;
  const s = row.subtypeName != null && row.subtypeName !== "" ? row.subtypeName : null;
  if (d != null && s != null) return `${d} · ${s}`;
  if (d != null) return d;
  if (s != null) return s;
  return "Unspecified";
}

export default function FilledSheetListPage() {
  const [sheets, setSheets] = useState<FilledSheetRow[]>([]);
  const [filtered, setFiltered] = useState<FilledSheetRow[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [disciplineOptions, setDisciplineOptions] = useState<Option[]>([]);
  const [subtypesRaw, setSubtypesRaw] = useState<Array<{ id: number; disciplineId: number; name: string }>>([]);
  const [categoryFilter, setCategoryFilter] = useState<Option | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<Option | null>(null);
  const [subtypeFilter, setSubtypeFilter] = useState<Option | null>(null);
  const [userFilter, setUserFilter] = useState<Option | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const { user } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [filledRes, templateRes] = await Promise.all([
          fetch("/api/backend/filledsheets/reference-options", { credentials: "include" }),
          fetch("/api/backend/templates/reference-options", { credentials: "include" }),
        ]);
        const filledData = await filledRes.json();
        const templateData = await templateRes.json();

        if (Array.isArray(filledData.categories)) {
          setCategories(
            filledData.categories.map((c: CategoryOption) => ({
              value: c.CategoryID,
              label: c.CategoryName,
            }))
          );
        } else {
          setCategories([]);
        }

        if (Array.isArray(filledData.users)) {
          setUsers(
            filledData.users.map((u: UserOption) => ({
              value: u.UserID,
              label: `${u.FirstName} ${u.LastName}`,
            }))
          );
        } else {
          setUsers([]);
        }

        if (Array.isArray(templateData.disciplines)) {
          setDisciplineOptions(
            templateData.disciplines.map((d: { id: number; name: string }) => ({ value: d.id, label: d.name }))
          );
        } else {
          setDisciplineOptions([]);
        }
        setSubtypesRaw(Array.isArray(templateData.subtypes) ? templateData.subtypes : []);
      } catch (err) {
        console.error("⛔ Failed to fetch reference options", err);
      }
    };

    const fetchSheets = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/backend/filledsheets", {
          credentials: "include",
        })
        const data = await res.json();
        setSheets(Array.isArray(data) ? data : []);
        setFiltered(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch filled sheets", err);
        setSheets([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
    fetchSheets();
  }, []);

  const subtypeOptions: Option[] =
    disciplineFilter === null
      ? subtypesRaw.map((s) => ({ value: s.id, label: s.name }))
      : subtypesRaw
          .filter((s) => s.disciplineId === disciplineFilter.value)
          .map((s) => ({ value: s.id, label: s.name }));

  useEffect(() => {
    let temp = [...sheets];
    if (categoryFilter) {
      temp = temp.filter((t) => t.categoryId === categoryFilter.value);
    }
    if (disciplineFilter) {
      temp = temp.filter((t) => t.disciplineId === disciplineFilter.value);
    }
    if (subtypeFilter) {
      temp = temp.filter((t) => t.subtypeId === subtypeFilter.value);
    }
    if (userFilter) {
      temp = temp.filter((t) => t.preparedById === userFilter.value);
    }
    if (dateFrom) {
      temp = temp.filter((t) => new Date(t.revisionDate) >= dateFrom);
    }
    if (dateTo) {
      temp = temp.filter((t) => new Date(t.revisionDate) <= dateTo);
    }
    setFiltered(temp);
  }, [categoryFilter, disciplineFilter, subtypeFilter, userFilter, dateFrom, dateTo, sheets]);

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      {loading ? (
        <p className="text-center text-gray-500 py-4">Loading filled sheets...</p>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Filled Datasheets</h1>
            <Link href="/datasheets/filled/create" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              + New Filled Sheet
            </Link>
          </div>

          <div className="bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Select
              options={categories}
              value={categoryFilter}
              onChange={(selected) => setCategoryFilter(selected as Option | null)}
              placeholder="Filter by Category"
              isClearable
            />
            <Select
              options={disciplineOptions}
              value={disciplineFilter}
              onChange={(selected) => {
                setDisciplineFilter(selected as Option | null);
                setSubtypeFilter(null);
              }}
              placeholder="Filter by Discipline"
              isClearable
            />
            <Select
              options={subtypeOptions}
              value={subtypeFilter}
              onChange={(selected) => setSubtypeFilter(selected as Option | null)}
              placeholder="Filter by Subtype"
              isClearable
            />
            <Select
              options={users}
              value={userFilter}
              onChange={(selected) => setUserFilter(selected as Option | null)}
              placeholder="Filter by Prepared By"
              isClearable
            />
            <DatePicker selected={dateFrom} onChange={setDateFrom} placeholderText="From Date" className="w-full border px-3 py-2 rounded" />
            <DatePicker selected={dateTo} onChange={setDateTo} placeholderText="To Date" className="w-full border px-3 py-2 rounded" />
          </div>

          <div className="overflow-x-auto border rounded bg-white">
            <table className="min-w-full table-auto text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2">📄 Sheet Name</th>
                  <th className="px-4 py-2">📝 Description</th>
                  <th className="px-4 py-2">Discipline / Subtype</th>
                  <th className="px-4 py-2">🏷 Category</th>
                  <th className="px-4 py-2">👤 Prepared By</th>
                  <th className="px-4 py-2">🗓 Revision Date</th>
                  <th className="px-4 py-2">⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.sheetId} className="border-t">
                    <td className="px-4 py-2 text-blue-600 hover:underline">
                      <Link href={`/datasheets/filled/${t.sheetId}`}>{t.sheetName}</Link>
                    </td>
                    <td className="px-4 py-2">{t.sheetDesc || '-'}</td>
                    <td className="px-4 py-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        title={disciplineSubtypeLabel(t)}
                      >
                        {disciplineSubtypeLabel(t)}
                      </span>
                    </td>
                    <td className="px-4 py-2">{t.categoryName || '-'}</td>
                    <td className="px-4 py-2">{t.preparedByName || '-'}</td>
                    <td className="px-4 py-2">{t.revisionDate ? format(new Date(t.revisionDate), 'MMM dd, yyyy') : '-'}</td>
                    <td className="px-4 py-2">
                      {user && (
                        <FilledSheetActions
                          sheet={{
                            sheetId: t.sheetId ?? 0,
                            preparedBy: t.preparedById ?? 0,
                            status: (t.status ?? "Draft") as
                              | "Draft"
                              | "Rejected"
                              | "Modified Draft"
                              | "Verified"
                              | "Approved",
                            isTemplate: false,
                          }}
                          user={user}
                          unitSystem="SI" 
                          language="eng" 
                          clientName="Internal" 
                          sheetName={t.sheetName}
                          revisionNum={1} 
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-500">No filled datasheets found.</td>
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
