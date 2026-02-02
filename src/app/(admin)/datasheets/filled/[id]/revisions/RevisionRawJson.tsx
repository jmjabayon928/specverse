'use client'

import { useCallback, useState } from 'react'

type Props = Readonly<{
  snapshot: unknown
}>

export default function RevisionRawJson({ snapshot }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = JSON.stringify(snapshot, null, 2)
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [snapshot])

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
      <pre className="overflow-auto rounded border border-gray-200 bg-gray-100 p-4 text-xs">
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </div>
  )
}
