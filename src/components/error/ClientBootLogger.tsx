'use client'

import { useEffect } from 'react'

type ErrorEventLike = {
  message?: string
  filename?: string
  lineno?: number
  colno?: number
  error?: unknown
}

export const ClientBootLogger = () => {
  useEffect(() => {
    const onError = (event: Event) => {
      const e = event as unknown as ErrorEventLike
      console.error('[window.error]', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[unhandledrejection]', {
        reason: event.reason
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}