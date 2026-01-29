import type { InfoField, UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'

export type DiffKind = 'changed' | 'added' | 'removed' | 'unchanged'

export type DiffRow = Readonly<{
  /** `${subsheetId}::${fieldKey}` where fieldKey is originalId|id|label fallback */
  key: string
  subsheetName: string
  label: string
  oldValue: string
  newValue: string
  kind: DiffKind
}>

export type DiffResult = Readonly<{
  counts: Readonly<{
    total: number
    changed: number
    added: number
    removed: number
    unchanged: number
  }>
  rows: DiffRow[]
}>

type FlattenedField = Readonly<{
  key: string
  subsheetName: string
  label: string
  value: string
}>

function stringifyFieldValue(value: InfoField['value']): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  return value
}

function getSubsheetIdentity(subsheet: UnifiedSubsheet): string {
  // UnifiedSubsheet.name is required, but keep this defensive.
  const raw = subsheet.originalId ?? subsheet.id ?? subsheet.name ?? 'unknown-subsheet'
  return String(raw)
}

function getFieldIdentity(field: InfoField): string {
  // Locked decision: originalId preferred, then id, then label.
  const raw = field.originalId ?? field.id ?? field.label
  return String(raw)
}

function flattenSheet(sheet: UnifiedSheet): Map<string, FlattenedField> {
  const map = new Map<string, FlattenedField>()

  for (const subsheet of sheet.subsheets) {
    const subsheetId = getSubsheetIdentity(subsheet)
    const subsheetName = subsheet.name

    for (const field of subsheet.fields) {
      const fieldId = getFieldIdentity(field)
      const key = `${subsheetId}::${fieldId}`
      const value = stringifyFieldValue(field.value)

      map.set(key, {
        key,
        subsheetName,
        label: field.label,
        value,
      })
    }
  }

  return map
}

export function diffUnifiedSheets(a: UnifiedSheet, b: UnifiedSheet): DiffResult {
  const aMap = flattenSheet(a)
  const bMap = flattenSheet(b)

  const rows: DiffRow[] = []
  const seenInB = new Set<string>()

  let changed = 0
  let added = 0
  let removed = 0
  let unchanged = 0

  for (const [key, aField] of aMap.entries()) {
    const bField = bMap.get(key)

    if (!bField) {
      removed += 1
      rows.push({
        key,
        subsheetName: aField.subsheetName,
        label: aField.label,
        oldValue: aField.value,
        newValue: '',
        kind: 'removed',
      })
      continue
    }

    seenInB.add(key)

    if (aField.value !== bField.value) {
      changed += 1
      rows.push({
        key,
        subsheetName: bField.subsheetName,
        label: bField.label,
        oldValue: aField.value,
        newValue: bField.value,
        kind: 'changed',
      })
    } else {
      unchanged += 1
      rows.push({
        key,
        subsheetName: bField.subsheetName,
        label: bField.label,
        oldValue: aField.value,
        newValue: bField.value,
        kind: 'unchanged',
      })
    }
  }

  for (const [key, bField] of bMap.entries()) {
    if (seenInB.has(key)) continue

    added += 1
    rows.push({
      key,
      subsheetName: bField.subsheetName,
      label: bField.label,
      oldValue: '',
      newValue: bField.value,
      kind: 'added',
    })
  }

  const total = rows.length

  return {
    counts: {
      total,
      changed,
      added,
      removed,
      unchanged,
    },
    rows,
  }
}

