// src/utils/normalizeUom.ts

/**
 * Normalize UOM to a single string for display and validation.
 * Handles API/DB edge cases where uom may be an array (e.g. ['kW','kW']) or other types.
 */
export function normalizeUom(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw.trim()
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const s = item.trim()
        if (s !== '') return s
      }
    }
    return ''
  }
  if (raw == null) {
    return ''
  }
  return String(raw).trim()
}
