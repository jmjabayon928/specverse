// src/app/(admin)/datasheets/layouts/[layoutId]/subsheetbuilder/[subId]/previewBridge.ts
import type { RenderField as PreviewRenderField } from "@/app/(admin)/datasheets/layouts/[layoutId]/preview/groupFields";

const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const pickNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const pickStr = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;
const pickCol = (v: unknown): 1 | 2 | undefined =>
  v === 1 || v === 2 ? v : undefined;

export function toPreviewRenderFields(raw: ReadonlyArray<unknown>): ReadonlyArray<PreviewRenderField> {
  const out: PreviewRenderField[] = [];

  for (const row of raw) {
    if (!rec(row)) continue;

    const infoTemplateId =
      pickNum((row as { infoTemplateId?: unknown }).infoTemplateId) ??
      pickNum((row as { InfoTemplateID?: unknown }).InfoTemplateID) ??
      pickNum((row as { infoTemplateID?: unknown }).infoTemplateID);
    if (infoTemplateId === undefined) continue;

    const label =
      pickStr((row as { label?: unknown }).label) ??
      pickStr((row as { Label?: unknown }).Label) ??
      "";

    const valueOpt =
      pickStr((row as { value?: unknown }).value) ??
      pickStr((row as { Value?: unknown }).Value) ??
      pickStr((row as { str?: unknown }).str);

    const rawValueOpt =
      pickStr((row as { rawValue?: unknown }).rawValue) ??
      pickStr((row as { RawValue?: unknown }).RawValue) ??
      pickStr((row as { raw?: unknown }).raw);

    const uom =
      pickStr((row as { uom?: unknown }).uom) ??
      pickStr((row as { UOM?: unknown }).UOM) ??
      undefined;

    const groupKey =
      pickStr((row as { groupKey?: unknown }).groupKey) ??
      pickStr((row as { group_key?: unknown }).group_key) ??
      undefined;

    const cellIndex =
      pickNum((row as { cellIndex?: unknown }).cellIndex) ??
      pickNum((row as { cell_index?: unknown }).cell_index) ??
      undefined;

    const cellCaption =
      pickStr((row as { cellCaption?: unknown }).cellCaption) ??
      pickStr((row as { cell_caption?: unknown }).cell_caption) ??
      undefined;

    const columnNumber =
      pickCol((row as { columnNumber?: unknown }).columnNumber) ??
      pickCol((row as { column_number?: unknown }).column_number) ??
      undefined;

    // Normalize to strict types expected by Preview:
    const rawValue: string | null = rawValueOpt ?? valueOpt ?? null;
    const value: string = valueOpt ?? (rawValue ?? "");

    out.push({
      infoTemplateId,
      label,
      value,      // string
      rawValue,   // string | null
      uom,
      groupKey,
      cellIndex,
      cellCaption,
      columnNumber,
    });
  }

  return out;
}
