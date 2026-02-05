// src/components/estimation/EstimationTable.tsx
'use client'

import Link from 'next/link'
import { EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { Estimation } from '@/domain/estimations/estimationTypes'

interface EstimationTableProps {
  estimations: Estimation[]
  onDelete?: (id: number) => void
}

const formatCreatedDate = (value: string | null | undefined): string => {
  if (!value) {
    return '-'
  }

  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return '-'
  }

  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

const formatCurrency = (amount: number | null | undefined): string => {
  if (typeof amount !== 'number') {
    return '-'
  }

  return `$${amount.toFixed(2)}`
}

const EstimationTable = (props: Readonly<EstimationTableProps>) => {
  const { estimations, onDelete } = props

  const handleDelete = async (id: number) => {
    const confirmed = globalThis.confirm(
      'Are you sure you want to delete this estimation?'
    )

    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/backend/estimation/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`)
      }

      if (onDelete) {
        onDelete(id)
      }
    } catch (error) {
      console.error('Failed to delete estimation', error)
      globalThis.alert('Unable to delete estimation. Please try again.')
    }
  }

  const hasRows = estimations.length > 0

  return (
    <div className='overflow-x-auto rounded border'>
      <table className='min-w-full text-sm'>
        <thead className='bg-gray-100 text-left'>
          <tr>
            <th className='px-4 py-2'>ID</th>
            <th className='px-4 py-2'>Client</th>
            <th className='px-4 py-2'>Project</th>
            <th className='px-4 py-2'>Title</th>
            <th className='px-4 py-2'>Status</th>
            <th className='px-4 py-2'>Created</th>
            <th className='px-4 py-2'>Total Material Cost</th>
            <th className='px-4 py-2 text-center'>Actions</th>
          </tr>
        </thead>
        <tbody>
          {hasRows === false ? (
            <tr>
              <td
                colSpan={8}
                className='px-4 py-4 text-center text-gray-500'
              >
                No estimations found.
              </td>
            </tr>
          ) : (
            estimations.map((estimation) => {
              const projectName = estimation.ProjectName ?? (estimation as Estimation & { ProjName?: string }).ProjName
              return (
              <tr
                key={estimation.EstimationID}
                className='border-t'
              >
                <td className='px-4 py-2'>
                  {estimation.EstimationID}
                </td>
                <td className='px-4 py-2'>
                  {estimation.ClientName ?? '-'}
                </td>
                <td className='px-4 py-2'>
                  {projectName ?? '-'}
                </td>
                <td className='px-4 py-2'>
                  {estimation.Title}
                </td>
                <td className='px-4 py-2'>
                  {estimation.Status}
                </td>
                <td className='px-4 py-2'>
                  {formatCreatedDate(estimation.CreatedAt as string | null)}
                </td>
                <td className='px-4 py-2'>
                  {formatCurrency(
                    estimation.TotalMaterialCost as number | null | undefined
                  )}
                </td>
                <td className='px-4 py-2'>
                  <div className='flex items-center justify-center gap-3 text-gray-600'>
                    <Link
                      href={`/estimation/${estimation.EstimationID}`}
                      title='View'
                    >
                      <EyeIcon className='h-5 w-5 hover:text-blue-600' />
                    </Link>

                    <Link
                      href={`/estimation/${estimation.EstimationID}/edit`}
                      title='Edit'
                    >
                      <PencilIcon className='h-5 w-5 hover:text-emerald-600' />
                    </Link>

                    <button
                      type='button'
                      onClick={() => handleDelete(estimation.EstimationID)}
                      title='Delete'
                    >
                      <TrashIcon className='h-5 w-5 hover:text-red-600' />
                    </button>
                  </div>
                </td>
              </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default EstimationTable
