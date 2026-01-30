// src/components/datasheets/SectionCompletenessSummary.tsx
// Section-level completeness text (UX only; no validation).

'use client'

import React from 'react'

interface Props {
  totalRequired: number
  filledRequired: number
  subName?: string
}

/**
 * Renders text like "2 required fields missing" or "All required fields complete".
 * Muted/secondary styling; no red/error.
 */
export default function SectionCompletenessSummary({
  totalRequired,
  filledRequired,
  subName,
}: Readonly<Props>) {
  const missing = totalRequired - filledRequired
  const text =
    totalRequired === 0
      ? null
      : missing === 0
        ? 'All required fields complete'
        : missing === 1
          ? '1 required field missing'
          : `${missing} required fields missing`

  if (text == null) return null
  return (
    <p className="text-sm text-gray-500 mt-1" data-section-completeness>
      {subName != null && subName !== '' ? `${subName}: ` : ''}
      {text}
    </p>
  )
}
