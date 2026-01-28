// src/components/datasheets/templates/SubsheetTabs.tsx
'use client'

import React from 'react'
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import type { UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'

type SubsheetTabsProps = {
  subsheets: UnifiedSubsheet[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  onRename: (index: number, newName: string) => void
  onAdd: () => void
  onDelete: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  children: React.ReactNode
}

const SubsheetTabs = (props: Readonly<SubsheetTabsProps>) => {
  const {
    subsheets,
    activeIndex,
    setActiveIndex,
    onRename,
    onAdd,
    onDelete,
    onMoveUp,
    onMoveDown,
    children,
  } = props

  const handleSelect = (index: number) => {
    setActiveIndex(index)
  }

  const handleRename = (index: number, value: string) => {
    onRename(index, value)
  }

  const handleMoveUp = (index: number) => {
    onMoveUp(index)
  }

  const handleMoveDown = (index: number) => {
    onMoveDown(index)
  }

  const handleDelete = (index: number) => {
    onDelete(index)
  }

  return (
    <div className='flex gap-4'>
      {/* Left column: subsheet selector */}
      <div className='w-64 border rounded-md bg-white shadow-sm p-2 space-y-2'>
        <div className='flex justify-between items-center mb-2'>
          <h3 className='text-sm font-semibold text-blue-700'>
            Subsheet Tabs
          </h3>
          <button
            type='button'
            onClick={onAdd}
            className='text-green-600 hover:underline text-sm flex items-center gap-1'
          >
            <PlusIcon className='w-4 h-4' />
            <span>Add</span>
          </button>
        </div>

        <fieldset className='space-y-2'>
          <legend className='sr-only'>Select subsheet</legend>

          {subsheets.map((sheet, index) => {
            const isActive = index === activeIndex
            const baseClasses = 'p-2 rounded border text-sm'
            const activeClasses = isActive
              ? 'bg-blue-100 border-blue-500 font-semibold'
              : 'hover:bg-gray-100'

            const cardClasses = `${baseClasses} ${activeClasses}`

            return (
              <div
                key={sheet.id ?? index}
                className={cardClasses}
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 flex-1'>
                    <input
                      type='radio'
                      name='subsheet-selection'
                      checked={isActive}
                      onChange={() => handleSelect(index)}
                      aria-label={`Select subsheet ${index + 1}`}
                    />
                    <input
                      type='text'
                      value={sheet.name}
                      onChange={(event) => handleRename(index, event.target.value)}
                      className='w-full bg-transparent border-none focus:outline-none text-sm font-medium'
                      aria-label={`Subsheet ${index + 1} name`}
                    />
                  </div>
                  <div className='flex gap-1 text-xs text-gray-500'>
                    <button
                      type='button'
                      title='Move up'
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                      className='disabled:opacity-50'
                    >
                      <ChevronUpIcon className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      title='Move down'
                      disabled={index === subsheets.length - 1}
                      onClick={() => handleMoveDown(index)}
                      className='disabled:opacity-50'
                    >
                      <ChevronDownIcon className='w-4 h-4' />
                    </button>
                    <button
                      type='button'
                      title='Delete subsheet'
                      onClick={() => handleDelete(index)}
                    >
                      <TrashIcon className='w-4 h-4 text-red-500' />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </fieldset>
      </div>

      {/* Right column: content of the active subsheet */}
      <div className='flex-1'>
        {children}
      </div>
    </div>
  )
}

export default SubsheetTabs
