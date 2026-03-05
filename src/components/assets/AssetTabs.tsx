'use client'

import { useState } from 'react'
import Link from 'next/link'
import AssetIdentityPanel from './AssetIdentityPanel'
import AssetLifecyclePanel from './AssetLifecyclePanel'
import AssetSchedulesPanel from './AssetSchedulesPanel'
import AssetActivityPanel from './AssetActivityPanel'
import type { AssetIdentityAsset } from './AssetIdentityPanel'

export type AssetTabsTab = 'overview' | 'custom-fields' | 'schedules' | 'activity' | 'datasheets' | 'documents-submittals' | 'mel' | 'checklists'

type Props = {
  assetId: number
  identityAsset: AssetIdentityAsset
  lastUpdated?: string
  activeTab?: AssetTabsTab
}

const TAB_LIST: { id: AssetTabsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'custom-fields', label: 'Custom Fields' },
  { id: 'schedules', label: 'Schedules' },
  { id: 'datasheets', label: 'Datasheets' },
  { id: 'documents-submittals', label: 'Documents / Submittals' },
  { id: 'mel', label: 'MEL' },
  { id: 'checklists', label: 'Checklists' },
  { id: 'activity', label: 'Audit / Activity' },
]

export default function AssetTabs({ assetId, identityAsset, lastUpdated, activeTab: propActiveTab }: Props) {
  const [clientActiveTab, setClientActiveTab] = useState<AssetTabsTab>('overview')
  const activeTab = propActiveTab ?? clientActiveTab

  return (
    <div className="space-y-4">
      <div className="border-b flex gap-6 text-sm">
        {TAB_LIST.map((tab) => {
          const isActive = activeTab === tab.id
          const isLink = tab.id === 'custom-fields' || tab.id === 'datasheets' || tab.id === 'documents-submittals' || tab.id === 'mel' || tab.id === 'checklists'
          
          if (tab.id === 'overview') {
            return (
              <Link
                key={tab.id}
                href={`/assets/${assetId}`}
                className={isActive ? 'font-medium text-gray-900 pb-3 border-b-2 border-gray-900' : 'text-gray-600 pb-3'}
              >
                {tab.label}
              </Link>
            )
          }
          
          if (isLink) {
            let href = ''
            if (tab.id === 'custom-fields') {
              href = `/assets/${assetId}/custom-fields`
            } else if (tab.id === 'datasheets') {
              href = `/assets/${assetId}/datasheets`
            } else if (tab.id === 'documents-submittals') {
              href = `/assets/${assetId}/documents`
            } else if (tab.id === 'mel') {
              href = `/assets/${assetId}/mel`
            } else if (tab.id === 'checklists') {
              href = `/assets/${assetId}/checklists`
            }
            return (
              <Link
                key={tab.id}
                href={href}
                className={isActive ? 'font-medium text-gray-900 pb-3 border-b-2 border-gray-900' : 'text-gray-600 pb-3'}
              >
                {tab.label}
              </Link>
            )
          }
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setClientActiveTab(tab.id)}
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
