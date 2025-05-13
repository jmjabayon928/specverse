'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';

type TemplateRow = {
  sheetId: number;
  sheetName: string;
  sheetDesc?: string;
  categoryId: number;
  categoryName: string;
  preparedById: number;
  preparedByName: string;
  revisionDate: string;
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

  useEffect(() => {
    const fetchOptions = async () => {
      const res = await fetch('/api/datasheets/templates/reference-options');
      const data = await res.json();
      setCategories(data.categories.map((c: any) => ({ value: c.id, label: c.name })));
      setUsers(data.users.map((u: any) => ({ value: u.id, label: u.name })));
    };

    const fetchTemplates = async () => {
      const res = await fetch('/api/datasheets/templates');
      const data = await res.json();
      setTemplates(data);
      setFiltered(data);
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Datasheet Templates</h1>
        <a href="/datasheets/templates/create" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
          + New Template
        </a>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select options={categories} value={categoryFilter} onChange={setCategoryFilter} placeholder="Filter by Category" isClearable />
        <Select options={users} value={userFilter} onChange={setUserFilter} placeholder="Filter by Prepared By" isClearable />
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
                <td className="px-4 py-2 space-x-2">
                  <a href={`/datasheets/templates/${t.sheetId}`} className="text-blue-600 hover:underline">View</a>
                  <a href={`/datasheets/templates/${t.sheetId}?edit=true`} className="text-green-600 hover:underline">Edit</a>
                  <button className="text-gray-600 hover:underline">Duplicate</button>
                  <button className="text-purple-600 hover:underline">Export</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">No templates found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
