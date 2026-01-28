// src/components/datasheets/templates/TemplateListView.tsx
'use client'

import React, { useMemo, useState } from 'react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type Option = {
  value: number
  label: string
}

type TemplateListViewProps = {
  categories: Option[]
  users: Option[]
}

type MockTemplateRow = {
  id: number
  name: string
  desc: string
  category: string
  preparedBy: string
  revisionDate: string
  subsheetCount: number
}

const mockTemplates: MockTemplateRow[] = [
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
]

const TemplateListView = (props: Readonly<TemplateListViewProps>) => {
  const { categories, users } = props

  const [selectedCategory, setSelectedCategory] = useState<Option | null>(null)
  const [selectedUser, setSelectedUser] = useState<Option | null>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const filteredTemplates = useMemo(() => {
    return mockTemplates.filter((template) => {
      if (selectedCategory !== null) {
        const sameCategory = template.category === selectedCategory.label
        if (!sameCategory) {
          return false
        }
      }

      if (selectedUser !== null) {
        const sameUser = template.preparedBy === selectedUser.label
        if (!sameUser) {
          return false
        }
      }

      const templateDate = new Date(template.revisionDate)

      if (dateFrom !== null) {
        const isBeforeFrom = templateDate < dateFrom
        if (isBeforeFrom) {
          return false
        }
      }

      if (dateTo !== null) {
        const isAfterTo = templateDate > dateTo
        if (isAfterTo) {
          return false
        }
      }

      return true
    })
  }, [selectedCategory, selectedUser, dateFrom, dateTo])

  return (
    <div className='space-y-6'>
      {/* Filter Bar */}
      <div className='grid md:grid-cols-4 gap-4'>
        <Select
          options={categories}
          value={selectedCategory}
          onChange={(option) => setSelectedCategory(option)}
          placeholder='Filter by Category'
          isClearable
        />
        <Select
          options={users}
          value={selectedUser}
          onChange={(option) => setSelectedUser(option)}
          placeholder='Filter by Prepared By'
          isClearable
        />
        <DatePicker
          selected={dateFrom}
          onChange={(date) => setDateFrom(date)}
          placeholderText='Date From'
          className='w-full border px-2 py-1 rounded'
        />
        <DatePicker
          selected={dateTo}
          onChange={(date) => setDateTo(date)}
          placeholderText='Date To'
          className='w-full border px-2 py-1 rounded'
        />
      </div>

      {/* Table */}
      <div className='overflow-x-auto border rounded shadow'>
        <table className='min-w-full table-auto'>
          <thead className='bg-gray-100 text-sm text-gray-700'>
            <tr>
              <th className='p-3 text-left'>📄 Template Name</th>
              <th className='p-3 text-left'>📝 Description</th>
              <th className='p-3 text-left'>🏷 Category</th>
              <th className='p-3 text-left'>👤 Prepared By</th>
              <th className='p-3 text-left'>🗓 Revision Date</th>
              <th className='p-3 text-center'>📊 Subsheet Count</th>
              <th className='p-3 text-center'>⚙️ Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.map((template) => (
              <tr key={template.id} className='border-t'>
                <td className='p-3'>
                  {template.name}
                </td>
                <td className='p-3'>
                  {template.desc}
                </td>
                <td className='p-3'>
                  {template.category}
                </td>
                <td className='p-3'>
                  {template.preparedBy}
                </td>
                <td className='p-3'>
                  {template.revisionDate}
                </td>
                <td className='p-3 text-center'>
                  {template.subsheetCount}
                </td>
                <td className='p-3 text-center space-x-2'>
                  <button
                    type='button'
                    className='text-blue-600 hover:underline'
                  >
                    View
                  </button>
                  <button
                    type='button'
                    className='text-green-600 hover:underline'
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    className='text-gray-600 hover:underline'
                  >
                    Duplicate
                  </button>
                  <button
                    type='button'
                    className='text-red-600 hover:underline'
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
            {filteredTemplates.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className='p-4 text-center text-gray-500'
                >
                  No templates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TemplateListView
