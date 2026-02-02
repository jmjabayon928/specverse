/**
 * Human-friendly display for diff/snapshot values.
 * Rules: null/undefined → "—"; empty string → "—"; booleans → Yes/No;
 * arrays → comma-separated; plain objects → single-line JSON; else String(value).
 */
export function formatDiffValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' && value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(formatDiffValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
