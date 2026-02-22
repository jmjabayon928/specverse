'use client'

import React from 'react'

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Minimal logging only. No refactors.
  console.error('[admin error.tsx] error', {
    message: error.message,
    stack: error.stack,
    digest: error.digest
  })

  return (
    <div style={{ padding: 16 }}>
      <h2>Something went wrong</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}