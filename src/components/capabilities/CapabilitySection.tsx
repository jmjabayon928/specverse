import React from 'react'
import type { CapabilitySectionModel } from '@/config/capabilities'

type Props = {
  section: CapabilitySectionModel
}

export default function CapabilitySection({ section }: Props) {
  return (
    <section className="mb-16 border-t border-gray-200 dark:border-gray-800 pt-12" aria-labelledby={`${section.id}-title`}>
      <div className="mb-6">
        <h2 id={`${section.id}-title`} className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
          {section.title}
        </h2>
        <div className="mt-2 h-1 w-16 bg-blue-600 rounded" />
        <p className="text-gray-600 dark:text-gray-400 mt-4 max-w-3xl">
          {section.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {section.items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {item.title}
            </h3>

            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 mt-3">
              {item.bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
