// src/utils/unitOtherAlternates.ts
import { normalizeUnit, getQuantityKind, SAME_SYSTEM_ALTERNATES } from "./unitKinds";

export function getOtherSameSystemUnits(unitRaw: string): string[] {
  const u = normalizeUnit(unitRaw);
  const kind = getQuantityKind(u);
  if (!kind) return [];
  const list = SAME_SYSTEM_ALTERNATES[u] ?? [];
  // Exclude the original from suggestions
  return list.filter((x) => x !== u);
}
