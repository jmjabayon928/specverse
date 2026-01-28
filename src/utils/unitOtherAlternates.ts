// src/utils/unitOtherAlternates.ts
import { normalizeUnit, getQuantityKind, SAME_SYSTEM_ALTERNATES } from './unitKinds'

export const getOtherSameSystemUnits = (unitRaw: string): string[] => {
  const normalized = normalizeUnit(unitRaw)
  const kind = getQuantityKind(normalized)

  if (!kind) {
    return []
  }

  const candidates = SAME_SYSTEM_ALTERNATES[normalized] ?? []

  // Exclude the original unit from the suggestion list
  return candidates.filter(unit => unit !== normalized)
}
