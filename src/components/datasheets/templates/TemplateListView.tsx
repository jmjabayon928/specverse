'use client';

import React, { useState } from 'react';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type Option = { value: number; label: string };
type Props = {
  categories: Option[];
  users: Option[];
};

const mockTemplates = [
  {
    id: 1,
    name: 'Pump Datasheet',
    desc: 'Centrifugal pump for cooling',
    category: 'Pumps',
    preparedBy: 'Alice Johnson',
    revisionDate: '2025-05-01',
    subsheetCount: 3,
  },
  {
    id: 2,
    name: 'Tank Spec',
    desc: 'Storage tank for chemicals',
    category: 'Tanks',
    preparedBy: 'Bob Smith',
    revisionDate: '2025-04-15',
    subsheetCount: 2,
  },
];

export default function TemplateListView({ categories, users }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<Option | null>(null);
  const [selectedUser, setSelectedUser] = useState<Option | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  const filteredTemplates = mockTemplates.filter((tpl) => {
    const matchesCategory = !selectedCategory || tpl.category === selectedCategory.label;
    const matchesUser = !selectedUser || tpl.preparedBy === selectedUser.label;
    const tplDate = new Date(tpl.revisionDate);
    const matchesDate =
      (!dateFrom || tplDate >= dateFrom) && (!dateTo || tplDate <= dateTo);
    return matchesCategory && matchesUser && matchesDate;
  });

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="grid md:grid-cols-4 gap-4">
        <Select
          options={categories}
          value={selectedCategory}
          onChange={(opt) => setSelectedCategory(opt)}
          placeholder="Filter by Category"
          isClearable
        />
        <Select
          options={users}
          value={selectedUser}
          onChange={(opt) => setSelectedUser(opt)}
          placeholder="Filter by Prepared By"
          isClearable
        />
        <DatePicker
          selected={dateFrom}
          onChange={(date) => setDateFrom(date)}
          placeholderText="Date From"
          className="input w-full"
        />
        <DatePicker
          selected={dateTo}
          onChange={(date) => setDateTo(date)}
          placeholderText="Date To"
          className="input w-full"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded shadow">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 text-sm text-gray-700">
            <tr>
              <th className="p-3 text-left">📄 Template Name</th>
              <th className="p-3 text-left">📝 Description</th>
              <th className="p-3 text-left">🏷 Category</th>
              <th className="p-3 text-left">👤 Prepared By</th>
              <th className="p-3 text-left">🗓 Revision Date</th>
              <th className="p-3 text-center">📊 Subsheet Count</th>
              <th className="p-3 text-center">⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.map((tpl) => (
              <tr key={tpl.id} className="border-t">
                <td className="p-3">{tpl.name}</td>
                <td className="p-3">{tpl.desc}</td>
                <td className="p-3">{tpl.category}</td>
                <td className="p-3">{tpl.preparedBy}</td>
                <td className="p-3">{tpl.revisionDate}</td>
                <td className="p-3 text-center">{tpl.subsheetCount}</td>
                <td className="p-3 text-center space-x-2">
                  <button className="text-blue-600 hover:underline">View</button>
                  <button className="text-green-600 hover:underline">Edit</button>
                  <button className="text-gray-600 hover:underline">Duplicate</button>
                  <button className="text-red-600 hover:underline">PDF</button>
                </td>
              </tr>
            ))}
            {filteredTemplates.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
                  No templates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
