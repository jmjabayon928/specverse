'use client'

import { useEffect, useMemo, useState } from 'react'
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
  disciplineId?: number | null
  disciplineName?: string | null
  subtypeId?: number | null
  subtypeName?: string | null
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

type DisciplineOption = {
  id: number
  code: string
  name: string
}

type SubtypeOption = {
  id: number
  disciplineId: number
  code: string
  name: string
}

type ReferenceOptionsResponse = {
  categories: CategoryOption[]
  users: UserOption[]
  disciplines?: DisciplineOption[]
  subtypes?: SubtypeOption[]
}

type SelectState = SelectOption | null

const isTemplateRow = (row: unknown): row is TemplateRow => {
  if (row === null) {
    return false
  }

  if (typeof row !== 'object') {
    return false
  }

  const candidate = row as Partial<TemplateRow>

  if (typeof candidate.sheetId !== 'number') {
    return false
  }

  if (typeof candidate.sheetName !== 'string') {
    return false
  }

  if (typeof candidate.categoryId !== 'number') {
    return false
  }

  if (typeof candidate.categoryName !== 'string') {
    return false
  }

  if (typeof candidate.preparedById !== 'number') {
    return false
  }

  if (typeof candidate.preparedByName !== 'string') {
    return false
  }

  if (typeof candidate.revisionDate !== 'string') {
    return false
  }

  if (typeof candidate.status !== 'string') {
    return false
  }

  return true
}

const isTemplateRowArray = (value: unknown): value is TemplateRow[] => {
  if (!Array.isArray(value)) {
    return false
  }

  for (const row of value) {
    if (isTemplateRow(row) === false) {
      return false
    }
  }

  return true
}

const isReferenceOptionsResponse = (value: unknown): value is ReferenceOptionsResponse => {
  if (value === null) {
    return false
  }

  if (typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ReferenceOptionsResponse>

  if (!Array.isArray(candidate.categories)) {
    return false
  }

  if (!Array.isArray(candidate.users)) {
    return false
  }

  return true
}

const isSelectOption = (value: unknown): value is SelectOption => {
  if (value === null) {
    return false
  }

  if (typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SelectOption>

  if (typeof candidate.value !== 'number') {
    return false
  }

  if (typeof candidate.label !== 'string') {
    return false
  }

  return true
}

const mapCategoriesToOptions = (categories: CategoryOption[]): SelectOption[] => {
  const options: SelectOption[] = []

  for (const category of categories) {
    options.push({
      value: category.CategoryID,
      label: category.CategoryName,
    })
  }

  return options
}

const mapUsersToOptions = (users: UserOption[]): SelectOption[] => {
  const options: SelectOption[] = []

  for (const user of users) {
    options.push({
      value: user.UserID,
      label: `${user.FirstName} ${user.LastName}`,
    })
  }

  return options
}

const mapDisciplinesToOptions = (disciplines: DisciplineOption[]): SelectOption[] =>
  disciplines.map((d) => ({ value: d.id, label: d.name }))

const mapSubtypesToOptions = (subtypes: SubtypeOption[]): SelectOption[] =>
  subtypes.map((s) => ({ value: s.id, label: s.name }))

function disciplineLabel(row: TemplateRow): string {
  if (row.disciplineName != null && row.disciplineName !== '') {
    return row.disciplineName
  }
  return 'Unspecified'
}

const TemplateListPage = () => {
  const { user } = useSession()

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [users, setUsers] = useState<SelectOption[]>([])
  const [disciplineOptions, setDisciplineOptions] = useState<SelectOption[]>([])
  const [subtypesRaw, setSubtypesRaw] = useState<SubtypeOption[]>([])

  const [categoryFilter, setCategoryFilter] = useState<SelectState>(null)
  const [disciplineFilter, setDisciplineFilter] = useState<SelectState>(null)
  const [subtypeFilter, setSubtypeFilter] = useState<SelectState>(null)
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

        if (isReferenceOptionsResponse(data) === false) {
          console.warn('Unexpected reference-options payload:', data)
          setCategories([])
          setUsers([])
          setDisciplineOptions([])
          setSubtypesRaw([])
          return
        }

        setCategories(mapCategoriesToOptions(data.categories))
        setUsers(mapUsersToOptions(data.users))
        setDisciplineOptions(mapDisciplinesToOptions(data.disciplines ?? []))
        setSubtypesRaw(data.subtypes ?? [])
      } catch (error: unknown) {
        console.error('Failed to fetch reference options', error)
        setCategories([])
        setUsers([])
        setDisciplineOptions([])
        setSubtypesRaw([])
      }
    }

    const fetchTemplates = async () => {
      setLoading(true)

      try {
        const res = await fetch('/api/backend/templates', {
          credentials: 'include',
        })

        const data: unknown = await res.json()

        if (isTemplateRowArray(data) === false) {
          console.warn('Templates fetch returned unexpected payload:', data)
          setTemplates([])
          return
        }

        setTemplates(data)
      } catch (error: unknown) {
        console.error('Failed to fetch templates', error)
        setTemplates([])
      } finally {
        setLoading(false)
      }
    }

    void fetchOptions()
    void fetchTemplates()
  }, [])

  const subtypeOptions = useMemo<SelectOption[]>(() => {
    if (disciplineFilter === null) {
      return mapSubtypesToOptions(subtypesRaw)
    }
    const disciplineId = disciplineFilter.value
    return mapSubtypesToOptions(subtypesRaw.filter((s) => s.disciplineId === disciplineId))
  }, [subtypesRaw, disciplineFilter])

  const filteredTemplates = useMemo<TemplateRow[]>(() => {
    let result = templates

    if (categoryFilter !== null) {
      const selectedCategoryId = categoryFilter.value
      result = result.filter((template) => template.categoryId === selectedCategoryId)
    }

    if (disciplineFilter !== null) {
      const selectedDisciplineId = disciplineFilter.value
      result = result.filter((template) => template.disciplineId === selectedDisciplineId)
    }

    if (subtypeFilter !== null) {
      const selectedSubtypeId = subtypeFilter.value
      result = result.filter((template) => template.subtypeId === selectedSubtypeId)
    }

    if (userFilter !== null) {
      const selectedUserId = userFilter.value
      result = result.filter((template) => template.preparedById === selectedUserId)
    }

    if (dateFrom !== null) {
      const fromStart = new Date(
        dateFrom.getFullYear(),
        dateFrom.getMonth(),
        dateFrom.getDate(),
        0,
        0,
        0,
        0
      ).getTime()

      result = result.filter((template) => {
        const timestamp = new Date(template.revisionDate).getTime()
        if (Number.isNaN(timestamp)) {
          return false
        }
        return timestamp >= fromStart
      })
    }

    if (dateTo !== null) {
      const toEnd = new Date(
        dateTo.getFullYear(),
        dateTo.getMonth(),
        dateTo.getDate(),
        23,
        59,
        59,
        999
      ).getTime()

      result = result.filter((template) => {
        const timestamp = new Date(template.revisionDate).getTime()
        if (Number.isNaN(timestamp)) {
          return false
        }
        return timestamp <= toEnd
      })
    }

    return result
  }, [templates, categoryFilter, disciplineFilter, subtypeFilter, userFilter, dateFrom, dateTo])

  if (process.env.NODE_ENV !== 'production') {
    // Helpful while wiring filters; safe to remove later
    console.log('Loaded templates (filtered):', filteredTemplates)
  }

  return (
    <SecurePage requiredPermission='DATASHEET_VIEW'>
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
          <div className='bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4'>
            <Select
              options={categories}
              value={categoryFilter}
              onChange={(newValue: unknown) => {
                if (isSelectOption(newValue)) {
                  setCategoryFilter(newValue)
                  return
                }
                setCategoryFilter(null)
              }}
              placeholder='Filter by Category'
              isClearable
            />
            <Select
              options={disciplineOptions}
              value={disciplineFilter}
              onChange={(newValue: unknown) => {
                if (isSelectOption(newValue)) {
                  setDisciplineFilter(newValue)
                  setSubtypeFilter(null)
                  return
                }
                setDisciplineFilter(null)
                setSubtypeFilter(null)
              }}
              placeholder='Filter by Discipline'
              isClearable
            />
            <Select
              options={subtypeOptions}
              value={subtypeFilter}
              onChange={(newValue: unknown) => {
                if (isSelectOption(newValue)) {
                  setSubtypeFilter(newValue)
                  return
                }
                setSubtypeFilter(null)
              }}
              placeholder='Filter by Subtype'
              isClearable
            />
            <Select
              options={users}
              value={userFilter}
              onChange={(newValue: unknown) => {
                if (isSelectOption(newValue)) {
                  setUserFilter(newValue)
                  return
                }
                setUserFilter(null)
              }}
              placeholder='Filter by Prepared By'
              isClearable
            />
            <DatePicker
              selected={dateFrom}
              onChange={(date: Date | null) => setDateFrom(date)}
              placeholderText='From Date'
              className='w-full border px-3 py-2 rounded'
            />
            <DatePicker
              selected={dateTo}
              onChange={(date: Date | null) => setDateTo(date)}
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
                  <th className='px-4 py-2'>Discipline</th>
                  <th className='px-4 py-2'>🏷 Category</th>
                  <th className='px-4 py-2'>👤 Prepared By</th>
                  <th className='px-4 py-2'>🗓 Revision Date</th>
                  <th className='px-4 py-2'>Status</th>
                  <th className='px-4 py-2'>⚙️ Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => (
                  <tr key={template.sheetId} className='border-t'>
                    <td className='px-4 py-2 text-blue-600 hover:underline'>
                      <Link href={`/datasheets/templates/${template.sheetId}`}>
                        {template.sheetName}
                      </Link>
                    </td>
                    <td className='px-4 py-2'>
                      {template.sheetDesc ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      <span
                        className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800'
                        title={disciplineLabel(template)}
                      >
                        {disciplineLabel(template)}
                      </span>
                    </td>
                    <td className='px-4 py-2'>
                      {template.categoryName ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      {template.preparedByName ?? '-'}
                    </td>
                    <td className='px-4 py-2'>
                      {template.revisionDate
                        ? format(new Date(template.revisionDate), 'MMM dd, yyyy')
                        : '-'}
                    </td>
                    <td className='px-4 py-2 capitalize'>
                      {template.status}
                    </td>
                    <td className='px-4 py-2 space-x-2'>
                      {user ? (
                        <TemplateActions
                          sheet={{
                            sheetId: template.sheetId,
                            preparedBy: template.preparedById,
                            status: template.status,
                            isTemplate: true,
                          }}
                          user={user}
                          unitSystem='SI'
                          language='eng'
                          clientName='Internal'
                          sheetName={template.sheetName}
                          revisionNum={1}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filteredTemplates.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
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
