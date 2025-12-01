'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import { format } from 'date-fns'

import 'react-datepicker/dist/react-datepicker.css'

import SecurePage from '@/components/security/SecurePage'
import { useSession } from '@/hooks/useSession'
import TemplateActions from '@/components/datasheets/templates/TemplateActions'

const Select = dynamic(() => import('react-select'), { ssr: false })

type TemplateStatus = 'Draft' | 'Rejected' | 'Modified Draft' | 'Verified' | 'Approved'

type TemplateRow = {
  sheetId: number
  sheetName: string
  sheetDesc?: string
  categoryId: number
  categoryName: string
  preparedById: number
  preparedByName: string
  revisionDate: string
  status: TemplateStatus
}

type CategoryOption = {
  CategoryID: number
  CategoryName: string
}

type UserOption = {
  UserID: number
  FirstName: string
  LastName: string
}

type SelectOption = {
  value: number
  label: string
}

type ReferenceOptionsResponse = {
  categories: CategoryOption[]
  users: UserOption[]
}

type SelectState = SelectOption | null

const isTemplateRow = (row: unknown): row is TemplateRow => {
  if (!row || typeof row !== 'object') return false
  const candidate = row as Partial<TemplateRow>

  return (
    typeof candidate.sheetId === 'number' &&
    typeof candidate.sheetName === 'string' &&
    typeof candidate.categoryId === 'number' &&
    typeof candidate.categoryName === 'string' &&
    typeof candidate.preparedById === 'number' &&
    typeof candidate.preparedByName === 'string' &&
    typeof candidate.revisionDate === 'string' &&
    typeof candidate.status === 'string'
  )
}

const isTemplateRowArray = (value: unknown): value is TemplateRow[] =>
  Array.isArray(value) && value.every(isTemplateRow)

const isReferenceOptionsResponse = (value: unknown): value is ReferenceOptionsResponse => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReferenceOptionsResponse>

  return Array.isArray(candidate.categories) && Array.isArray(candidate.users)
}

const mapCategoriesToOptions = (categories: CategoryOption[]): SelectOption[] =>
  categories.map((c) => ({
    value: c.CategoryID,
    label: c.CategoryName,
  }))

const mapUsersToOptions = (users: UserOption[]): SelectOption[] =>
  users.map((u) => ({
    value: u.UserID,
    label: `${u.FirstName} ${u.LastName}`,
  }))

const TemplateListPage = () => {
  const { user } = useSession()

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [filtered, setFiltered] = useState<TemplateRow[]>([])
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [users, setUsers] = useState<SelectOption[]>([])

  const [categoryFilter, setCategoryFilter] = useState<SelectState>(null)
  const [userFilter, setUserFilter] = useState<SelectState>(null)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch('/api/backend/templates/reference-options', {
          credentials: 'include',
        })

        const data: unknown = await res.json()

        if (!isReferenceOptionsResponse(data)) {
          console.warn('Unexpected reference-options payload:', data)
          setCategories([])
          setUsers([])
          return
        }

        setCategories(mapCategoriesToOptions(data.categories))
        setUsers(mapUsersToOptions(data.users))
      } catch (err) {
        console.error('Failed to fetch reference options', err)
        setCategories([])
        setUsers([])
      }
    }

    const fetchTemplates = async () => {
      setLoading(true)

      try {
        const res = await fetch('/api/backend/templates', {
          credentials: 'include',
        })

        const data: unknown = await res.json()

        if (!isTemplateRowArray(data)) {
          console.warn('Templates fetch returned unexpected payload:', data)
          setTemplates([])
          setFiltered([])
          return
        }

        setTemplates(data)
        setFiltered(data)
      } catch (err) {
        console.error('Failed to fetch templates', err)
        setTemplates([])
        setFiltered([])
      } finally {
        setLoading(false)
      }
    }

    void fetchOptions()
    void fetchTemplates()
  }, [])

  const filteredTemplates = useMemo<TemplateRow[]>(() => {
    let result = [...templates]

    if (categoryFilter) {
      result = result.filter((t) => t.categoryId === categoryFilter.value)
    }

    if (userFilter) {
      result = result.filter((t) => t.preparedById === userFilter.value)
    }

    if (dateFrom) {
      result = result.filter((t) => new Date(t.revisionDate) >= dateFrom)
    }

    if (dateTo) {
      result = result.filter((t) => new Date(t.revisionDate) <= dateTo)
    }

    return result
  }, [categoryFilter, userFilter, dateFrom, dateTo, templates])

  useEffect(() => {
    setFiltered(filteredTemplates)
  }, [filteredTemplates])

  if (process.env.NODE_ENV !== 'production') {
    console.log('Loaded templates:', filtered)
  }

  return (
    <SecurePage requiredPermission='TEMPLATES_VIEW'>
      {loading ? (
        <p className='text-center text-gray-500 py-4'>
          Loading templates...
        </p>
      ) : (
        <div className='p-6 space-y-6'>
          <div className='flex justify-between items-center'>
            <h1 className='text-2xl font-bold'>
              Datasheet Templates
            </h1>
            <Link
              href='/datasheets/templates/create'
              className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm'
            >
              + New Template
            </Link>
          </div>

          {/* Filter Bar */}
          <div className='bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-4 gap-4'>
            <Select
              options={categories}
              value={categoryFilter}
              onChange={(newValue) => setCategoryFilter((newValue as SelectOption) ?? null)}
              placeholder='Filter by Category'
              isClearable
            />
            <Select
              options={users}
              value={userFilter}
              onChange={(newValue) => setUserFilter((newValue as SelectOption) ?? null)}
              placeholder='Filter by Prepared By'
              isClearable
            />
            <DatePicker
              selected={dateFrom}
              onChange={(date) => setDateFrom(date)}
              placeholderText='From Date'
              className='w-full border px-3 py-2 rounded'
            />
            <DatePicker
              selected={dateTo}
              onChange={(date) => setDateTo(date)}
              placeholderText='To Date'
              className='w-full border px-3 py-2 rounded'
            />
          </div>

          {/* Table */}
          <div className='overflow-x-auto border rounded bg-white'>
            <table className='min-w-full table-auto text-sm text-left'>
              <thead className='bg-gray-100'>
                <tr>
                  <th className='px-4 py-2'>📄 Template Name</th>
                  <th className='px-4 py-2'>📝 Description</th>
                  <th className='px-4 py-2'>🏷 Category</th>
                  <th className='px-4 py-2'>👤 Prepared By</th>
                  <th className='px-4 py-2'>🗓 Revision Date</th>
                  <th className='px-4 py-2'>Status</th>
                  <th className='px-4 py-2'>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.sheetId} className='border-t'>
                    <td className='px-4 py-2 text-blue-600 hover:underline'>
                      <Link href={`/datasheets/templates/${t.sheetId}`}>
                        {t.sheetName}
                      </Link>
                    </td>
                    <td className='px-4 py-2'>
                      {t.sheetDesc ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      {t.categoryName ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      {t.preparedByName ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      {t.revisionDate
                        ? format(new Date(t.revisionDate), 'MMM dd, yyyy')
                        : '-'}
                    </td>
                    <td className='px-4 py-2 capitalize'>
                      {t.status}
                    </td>
                    <td className='px-4 py-2 space-x-2'>
                      {user ? (
                        <TemplateActions
                          sheet={{
                            sheetId: t.sheetId,
                            preparedBy: t.preparedById,
                            status: t.status,
                            isTemplate: true,
                          }}
                          user={user}
                          unitSystem='SI'
                          language='eng'
                          clientName='Internal'
                          sheetName={t.sheetName}
                          revisionNum={1}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className='text-center py-4 text-gray-500'
                    >
                      No templates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SecurePage>
  )
}

export default TemplateListPage
