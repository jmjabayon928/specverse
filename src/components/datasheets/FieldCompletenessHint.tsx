// src/components/datasheets/FieldCompletenessHint.tsx
// Shows a hint only when the field is required and incomplete (UX only; no validation).

'use client'

import React from 'react'

const HINT_TEXT = 'Required field is empty'

interface Props {
  /** Show hint only when true (required and value missing/blank) */
  show: boolean
}

/**
 * Renders a small muted hint with tooltip when the field is required and incomplete.
 * Renders nothing when show is false. No red/error styling.
 */
export default function FieldCompletenessHint({ show }: Readonly<Props>) {
  if (!show) return null
  return (
    <span
      className="ml-1 text-gray-500 text-xs"
      title={HINT_TEXT}
      aria-label={HINT_TEXT}
    >
      ({HINT_TEXT})
    </span>
  )
}
