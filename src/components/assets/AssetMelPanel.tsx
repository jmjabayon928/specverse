// src/components/assets/AssetMelPanel.tsx
import type { AssetCustomFieldDto } from '@/types/api/assets'

type Props = {
  customFields: AssetCustomFieldDto[]
}

const FALLBACK = '—'

/**
 * Formats a custom field value for display.
 * - null/undefined -> "—"
 * - boolean -> "Yes"/"No"
 * - Date objects -> formatted using Intl.DateTimeFormat
 * - ISO-8601 date strings (e.g., "2024-01-15T10:30:00") -> parsed and formatted
 * - Other values -> String(value)
 */
function formatValue(value: string | number | boolean | Date | null | undefined): string {
  if (value == null) return FALLBACK

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat().format(value)
  }

  // Only parse ISO-8601-like date strings (e.g., "2024-01-15T10:30:00" or "2024-01-15T10:30:00.000Z")
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat().format(date)
      }
    } catch {
      // Fall through to string conversion
    }
  }

  return String(value)
}

function Row({ label, value }: { label: string; value: string | number | boolean | Date | null | undefined }) {
  const display = formatValue(value)
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-medium text-sm text-right">{display}</span>
    </div>
  )
}

export default function AssetMelPanel({ customFields }: Props) {
  if (customFields.length === 0) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">MEL Fields</h2>
        <p className="text-sm text-gray-500">No custom fields available for this asset.</p>
      </div>
    )
  }

  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">MEL Fields</h2>
      <div className="space-y-0">
        {customFields.map((field) => (
          <Row key={field.customFieldId} label={field.displayLabel} value={field.value} />
        ))}
      </div>
    </div>
  )
}
