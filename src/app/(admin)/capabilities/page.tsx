import React from 'react'
import { capabilitiesPageModel } from '@/config/capabilities'
import CapabilitySection from '@/components/capabilities/CapabilitySection'

export default function CapabilitiesPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-16 pb-10 border-b border-gray-200 dark:border-gray-800">
        <p className="text-sm uppercase tracking-wide text-gray-500 mb-3">
          Enterprise Architecture Overview
        </p>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          {capabilitiesPageModel.hero.title}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
          {capabilitiesPageModel.hero.subtitle}
        </p>
      </div>

      <div className="space-y-12">
        {capabilitiesPageModel.sections.map((section) => (
          <CapabilitySection key={section.id} section={section} />
        ))}
      </div>
    </main>
  )
}
