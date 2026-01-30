// src/components/datasheets/SheetCompletenessBanner.tsx
// Sheet-level completeness banner/badge (UX only; no validation).

'use client'

import React from 'react'

interface Props {
  totalRequired: number
  filledRequired: number
}

/**
 * Renders a top banner/badge with total missing or percentage.
 * When all complete, shows "All required fields complete". Muted styling.
 */
export default function SheetCompletenessBanner({
  totalRequired,
  filledRequired,
}: Readonly<Props>) {
  if (totalRequired === 0) return null
  const missing = totalRequired - filledRequired
  const percent =
    totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100
  const text =
    missing === 0
      ? 'All required fields complete'
      : missing === 1
        ? '1 required field missing across this datasheet'
        : `${missing} required fields missing across this datasheet (${percent}% complete)`

  return (
    <div
      className="mb-4 py-2 px-3 rounded bg-gray-100 text-gray-700 text-sm"
      data-sheet-completeness
      role="status"
      aria-live="polite"
    >
      {text}
    </div>
  )
}
