// src/utils/structureErrorToast.ts
// 400 response body from structure endpoints may include Zod issues.

import toast from 'react-hot-toast'

export interface StructureErrorBody {
  error?: string
  issues?: Array<{ path?: string; message?: string }>
}

export function structureErrorToast(body: StructureErrorBody, fallback: string): void {
  if (body.issues && body.issues.length > 0) {
    const first = body.issues[0].message ?? 'Invalid payload'
    const suffix = body.issues.length > 1 ? ` (+${body.issues.length - 1} more)` : ''
    toast.error(`Invalid field update: ${first}${suffix}`)
  } else {
    toast.error(body.error ?? fallback)
  }
}
