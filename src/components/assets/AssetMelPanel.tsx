// src/components/assets/AssetMelPanel.tsx
import type { AssetCustomFieldDto } from '@/types/api/assets'

type Props = {
  customFields: AssetCustomFieldDto[]
  keyFieldPriority?: Record<string, number>
}

const FALLBACK = '—'

type DisplayField = {
  label: string
  value: string | number | boolean | Date | null
  sortKey: number
  groupKey: 'key' | 'other'
  customFieldId: number
  matchedKey?: string
}

/**
 * Default key MEL field priorities: maps normalized key strings to priority order.
 * Lower number = higher priority (appears first).
 */
const DEFAULT_KEY_FIELD_PRIORITY: Record<string, number> = {
  manufacturer: 1,
  model: 2,
  voltage: 3,
  current: 4,
  power: 5,
  location: 6,
  system: 7,
  service: 8,
  notes: 9,
}

type MatchResult = {
  matchedKey: string
  sortKey: number
  matchType: 'exact' | 'includes'
  keyLength: number
}

/**
 * Determines if a field is a key MEL field and returns match details.
 * Returns null if not a key field.
 * Uses deterministic matching: exact > includes, longest key if tied, lowest priority if still tied.
 */
function findKeyFieldMatch(
  field: AssetCustomFieldDto,
  keyFieldPriority: Record<string, number>
): MatchResult | null {
  const fieldKeyNormalized = field.fieldKey.toLowerCase().trim()
  const displayLabelNormalized = field.displayLabel.toLowerCase().trim()

  const candidates: MatchResult[] = []

  for (const [key, priority] of Object.entries(keyFieldPriority)) {
    const keyNormalized = key.toLowerCase().trim()

    // Check fieldKey first
    if (fieldKeyNormalized === keyNormalized) {
      candidates.push({
        matchedKey: key,
        sortKey: priority,
        matchType: 'exact',
        keyLength: keyNormalized.length,
      })
    } else if (fieldKeyNormalized.includes(keyNormalized)) {
      candidates.push({
        matchedKey: key,
        sortKey: priority,
        matchType: 'includes',
        keyLength: keyNormalized.length,
      })
    }

    // Check displayLabel
    if (displayLabelNormalized === keyNormalized) {
      candidates.push({
        matchedKey: key,
        sortKey: priority,
        matchType: 'exact',
        keyLength: keyNormalized.length,
      })
    } else if (displayLabelNormalized.includes(keyNormalized)) {
      candidates.push({
        matchedKey: key,
        sortKey: priority,
        matchType: 'includes',
        keyLength: keyNormalized.length,
      })
    }
  }

  if (candidates.length === 0) return null

  // Choose best match: exact > includes, longest key if tied, lowest priority if still tied
  candidates.sort((a, b) => {
    if (a.matchType !== b.matchType) {
      return a.matchType === 'exact' ? -1 : 1
    }
    if (a.keyLength !== b.keyLength) {
      return b.keyLength - a.keyLength
    }
    return a.sortKey - b.sortKey
  })

  return candidates[0]
}

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

export default function AssetMelPanel({ customFields, keyFieldPriority = DEFAULT_KEY_FIELD_PRIORITY }: Props) {
  if (customFields.length === 0) {
    return (
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">MEL Fields</h2>
        <p className="text-sm text-gray-500">No custom fields available for this asset.</p>
      </div>
    )
  }

  // Normalize fields into display model
  const displayFields: DisplayField[] = customFields.map((field) => {
    const match = findKeyFieldMatch(field, keyFieldPriority)
    return {
      label: field.displayLabel,
      value: field.value,
      sortKey: match?.sortKey ?? 999, // Non-key fields get high sortKey
      groupKey: match !== null ? 'key' : 'other',
      customFieldId: field.customFieldId,
      matchedKey: match?.matchedKey,
    }
  })

  // DEV-only collision warning
  if (process.env.NODE_ENV !== 'production') {
    const matchedKeyGroups = new Map<string, DisplayField[]>()
    displayFields.forEach((f) => {
      if (f.groupKey === 'key' && f.matchedKey) {
        const existing = matchedKeyGroups.get(f.matchedKey) || []
        existing.push(f)
        matchedKeyGroups.set(f.matchedKey, existing)
      }
    })

    matchedKeyGroups.forEach((fields, matchedKey) => {
      if (fields.length > 1) {
        const idsCsv = fields.map((f) => f.customFieldId).join(',')
        console.warn(
          `[AssetMelPanel] Duplicate key MEL match for "${matchedKey}" (${fields.length}) customFieldIds=${idsCsv}`
        )
      }
    })
  }

  // Separate into groups with deterministic sorting
  const keyFields = displayFields
    .filter((f) => f.groupKey === 'key')
    .sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
      const labelCompare = a.label.toLowerCase().localeCompare(b.label.toLowerCase())
      if (labelCompare !== 0) return labelCompare
      return a.customFieldId - b.customFieldId
    })

  const otherFields = displayFields
    .filter((f) => f.groupKey === 'other')
    .sort((a, b) => {
      const labelCompare = a.label.toLowerCase().localeCompare(b.label.toLowerCase())
      if (labelCompare !== 0) return labelCompare
      return a.customFieldId - b.customFieldId
    })

  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">MEL Fields</h2>
      <div className="space-y-4">
        {keyFields.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Key MEL Fields</h3>
            <div className="space-y-0">
              {keyFields.map((field) => (
                <Row key={field.customFieldId} label={field.label} value={field.value} />
              ))}
            </div>
          </div>
        )}
        {otherFields.length > 0 && (
          <div>
            {keyFields.length > 0 && <div className="border-t border-gray-200 my-2" />}
            <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Other Fields</h3>
            <div className="space-y-0">
              {otherFields.map((field) => (
                <Row key={field.customFieldId} label={field.label} value={field.value} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
