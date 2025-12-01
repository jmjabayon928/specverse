/**
 * SpecVerse Preview (refactor split) — Performance-safe
 * Strict TypeScript, no `any`. Pure functions + small components.
 * This file is part of: /datasheets/layouts/[layoutId]/preview
 */

// layout/applySubsheetLayout.ts
import { groupFields, RenderField } from "../groupFields";

export type SubsheetSlotsConfig = Readonly<{
  merged: boolean;
  left: ReadonlyArray<{ index: number; infoTemplateId: number }>;
  right: ReadonlyArray<{ index: number; infoTemplateId: number }>;
}>;

export type GroupedRows = ReadonlyArray<ReturnType<typeof groupFields>[number]>;

export function buildFieldMap(fields: ReadonlyArray<RenderField>): Map<number, RenderField> {
  const m = new Map<number, RenderField>();
  for (const f of fields) if (!m.has(f.infoTemplateId)) m.set(f.infoTemplateId, f); // first wins
  return m;
}

export function materializeBySlots(
  fieldMap: ReadonlyMap<number, RenderField>,
  slots: ReadonlyArray<{ index: number; infoTemplateId: number }>
): ReadonlyArray<RenderField> {
  const out: RenderField[] = [];
  for (const s of slots) {
    const f = fieldMap.get(s.infoTemplateId);
    if (f) out.push(f);
  }
  return out;
}

/** Converts a subsheet's fields + saved layout slots into grouped rows for rendering. */
export function applySubsheetLayout(
  fields: ReadonlyArray<RenderField>,
  cfg: SubsheetSlotsConfig | undefined | null
): { mode: "merged" | "two-col" | "fallback"; left?: GroupedRows; right?: GroupedRows; merged?: GroupedRows } {
  const fieldById = buildFieldMap(fields);

  if (cfg && (cfg.left.length + cfg.right.length) > 0) {
    const plannedTids = new Set<number>([...cfg.left, ...cfg.right].map(x => x.infoTemplateId));
    const leftovers = fields.filter(f => !plannedTids.has(f.infoTemplateId));

    if (cfg.merged) {
      const mergedOrder = [...cfg.left, ...cfg.right];
      const visible = [...materializeBySlots(fieldById, mergedOrder), ...leftovers];
      return { mode: "merged", merged: groupFields(visible, { preserveOrder: true }) };
    }

    const leftFields = materializeBySlots(fieldById, cfg.left);
    const rightFields = materializeBySlots(fieldById, cfg.right);

    // Append leftovers to the shorter column to keep visual balance
    const L: RenderField[] = [...leftFields];
    const R: RenderField[] = [...rightFields];
    for (const f of leftovers) (L.length <= R.length ? L : R).push(f);

    return {
      mode: "two-col",
      left: groupFields(L, { preserveOrder: true }),
      right: groupFields(R, { preserveOrder: true }),
    };
  }

  // No saved layout → fallback renders everything in incoming order
  return { mode: "fallback", merged: groupFields(fields, { preserveOrder: true }) };
}
