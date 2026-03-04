'use client'

import { useState } from 'react'
import Link from 'next/link'
import AssetIdentityPanel from './AssetIdentityPanel'
import AssetLifecyclePanel from './AssetLifecyclePanel'
import AssetSchedulesPanel from './AssetSchedulesPanel'
import AssetActivityPanel from './AssetActivityPanel'
import type { AssetIdentityAsset } from './AssetIdentityPanel'

export type AssetTabsTab = 'overview' | 'custom-fields' | 'schedules' | 'activity'

type Props = {
  assetId: number
  identityAsset: AssetIdentityAsset
  lastUpdated?: string
}

const TAB_LIST: { id: AssetTabsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'custom-fields', label: 'Custom Fields' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'activity', label: 'Activity' },
]

export default function AssetTabs({ assetId, identityAsset, lastUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<AssetTabsTab>('overview')

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-6 text-sm">
        {TAB_LIST.map((tab) => {
          const isActive = activeTab === tab.id
          const isLink = tab.id === 'custom-fields'
          if (isLink) {
            return (
              <Link
                key={tab.id}
                href={`/assets/${assetId}/custom-fields`}
                className="text-blue-600 underline pb-3"
              >
                {tab.label}
              </Link>
            )
          }
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'font-medium text-gray-900 pb-3 border-b-2 border-gray-900' : 'text-gray-600 pb-3'}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AssetIdentityPanel asset={identityAsset} />
          <AssetLifecyclePanel assetId={assetId} lastUpdated={lastUpdated} />
        </div>
      )}

      {activeTab === 'schedules' && <AssetSchedulesPanel />}
      {activeTab === 'activity' && <AssetActivityPanel />}
    </div>
  )
}
