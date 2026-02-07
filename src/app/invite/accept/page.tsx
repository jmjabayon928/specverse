import { Suspense } from 'react'
import InviteAcceptClient from './InviteAcceptClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      }
    >
      <InviteAcceptClient />
    </Suspense>
  )
}
