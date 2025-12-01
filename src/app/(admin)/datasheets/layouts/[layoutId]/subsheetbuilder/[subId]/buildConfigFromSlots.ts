import type { SubsheetSlotsConfig } from "@/app/(admin)/datasheets/layouts/[layoutId]/preview/layout/applySubsheetLayout";

export type SlotsResponse = Readonly<{ left: number[]; right: number[]; merged: boolean }>;

export function buildConfigFromSlots(slots: SlotsResponse): Readonly<SubsheetSlotsConfig> {
  const toObjects = (ids: ReadonlyArray<number>) =>
    ids
      .map((id, index) =>
        (typeof id === "number" && Number.isFinite(id)) ? { index, infoTemplateId: id } : null
      )
      .filter((x): x is { index: number; infoTemplateId: number } => !!x);

  return {
    merged: slots.merged === true,
    left: toObjects(slots.left),
    right: toObjects(slots.right),
  } as const;
}
