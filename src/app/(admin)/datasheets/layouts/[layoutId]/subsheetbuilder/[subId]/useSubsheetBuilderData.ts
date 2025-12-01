"use client";

import * as React from "react";
import { buildConfigFromSlots } from "./buildConfigFromSlots";
import { toPreviewRenderFields } from "./previewBridge";
import type { RenderField as PreviewRenderField } from "@/app/(admin)/datasheets/layouts/[layoutId]/preview/groupFields";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────
export type SlotsResponse = Readonly<{ left: number[]; right: number[]; merged: boolean }>;

type StructureResponse = Readonly<{
  subsheets: ReadonlyArray<{ subsheetId: number; subsheetName: string }>;
}>;

type RenderResponse = Readonly<{
  header?: unknown;
  body?: ReadonlyArray<{
    subsheetId: number;
    subsheetName?: string | null;
    fields?: ReadonlyArray<Record<string, unknown>>;
  }>;
}>;

type RenderBlock = Readonly<{
  subsheetId: number;
  subsheetName?: string | null;
  fields: ReadonlyArray<PreviewRenderField>;
}>;

type Params = Readonly<{ layoutId: string; subId: string }>;

type FilledField = Readonly<{
  infoTemplateId: number;
  label: string;
  valueStr: string;
  rawValue: string | null;
  uom?: string;
  groupKey?: string;
  cellIndex?: number;
  cellCaption?: string;
}>;

type FilledSheetResponse = Readonly<{
  items?: ReadonlyArray<Record<string, unknown>>;
  fields?: ReadonlyArray<Record<string, unknown>>;
}>;

// ────────────────────────────────────────────────────────────────────────────────
// Small helpers
// ────────────────────────────────────────────────────────────────────────────────
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const trimQ = (s: string) => s.replaceAll(/\s+/g, " ").trim();

const asFiniteNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// ────────────────────────────────────────────────────────────────────────────────
// Backend fetchers
// ────────────────────────────────────────────────────────────────────────────────
async function fetchLayoutMeta(layoutId: string): Promise<{ sheetId: number | null; sheetTitle: string | null }> {
  const r = await fetch(`/api/backend/layouts/${layoutId}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(`Layout ${layoutId} not found`);

  const json = (await r.json()) as Record<string, unknown>;

  const sidLike =
    (json as { SheetID?: unknown }).SheetID ??
    (json as { sheetId?: unknown }).sheetId;

  const sidNum = asFiniteNumber(sidLike);
  const sheetId = sidNum ?? null;

  const nameRaw = (json as { SheetName?: unknown }).SheetName;
  const sheetTitle = typeof nameRaw === "string" && nameRaw.trim() ? trimQ(nameRaw) : null;

  return { sheetId, sheetTitle };
}

async function fetchSubsheetTitle(layoutId: string, subId: number): Promise<string | null> {
  const r = await fetch(`/api/backend/layouts/${layoutId}/structure`, { credentials: "include", cache: "no-store" });
  if (!r.ok) return null;

  const structure = (await r.json()) as StructureResponse;
  const found = structure.subsheets.find((s) => s.subsheetId === subId);
  return found?.subsheetName ? trimQ(found.subsheetName) : null;
}

async function fetchSlots(layoutId: string, subId: string): Promise<SlotsResponse> {
  const r = await fetch(`/api/backend/layouts/${layoutId}/subsheets/${subId}/slots`, {
    credentials: "include",
    cache: "no-store",
  });

  if (!r.ok) {
    return { left: [], right: [], merged: false };
  }

  const s = (await r.json()) as SlotsResponse;

  const left = Array.isArray(s.left) ? s.left.filter(isFiniteNum) : [];
  const right = Array.isArray(s.right) ? s.right.filter(isFiniteNum) : [];
  const merged = s.merged === true;

  return { left, right, merged };
}

async function fetchRenderBlockForSubsheet(params: {
  layoutId: string;
  subId: number;
  sheetId: number;
  uom: "SI" | "USC";
  lang: "en" | "fr";
}): Promise<RenderBlock | null> {
  const { layoutId, subId, sheetId, uom, lang } = params;
  const url = `/api/backend/layouts/${layoutId}/render?sheetId=${sheetId}&uom=${uom}&lang=${lang}`;

  const r = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!r.ok) return null;

  const json = (await r.json()) as RenderResponse;
  const body = Array.isArray(json.body) ? json.body : [];

  // 🔧 Coerce `subsheetId` from payload to number before compare:
  const match = body.find((b) => {
    const sidRaw = (b as { subsheetId?: unknown }).subsheetId;
    const sidNum = typeof sidRaw === "number" ? sidRaw : Number(sidRaw);
    return Number.isFinite(sidNum) && sidNum === subId;
  });

  if (!match) return null;

  const b = match as {
    subsheetId: number | string;
    subsheetName?: string | null;
    fields?: ReadonlyArray<unknown>;
  };

  const rawFields = Array.isArray(b.fields) ? b.fields : [];

  // If fields are already Preview-shaped, pass-through, else normalize:
  const looksLikePreviewField = (v: unknown): v is PreviewRenderField => {
    if (!v || typeof v !== "object") return false;
    const r = v as { infoTemplateId?: unknown; label?: unknown; value?: unknown; rawValue?: unknown };
    return (
      typeof r.infoTemplateId === "number" &&
      Number.isFinite(r.infoTemplateId) &&
      typeof r.label === "string" &&
      typeof r.value === "string" &&
      (typeof r.rawValue === "string" || r.rawValue === null || r.rawValue === undefined)
    );
  };

  const fields: ReadonlyArray<PreviewRenderField> =
    rawFields.every(looksLikePreviewField) ? (rawFields as ReadonlyArray<PreviewRenderField>) : toPreviewRenderFields(rawFields);

  return {
    subsheetId: Number((match as { subsheetId: number | string }).subsheetId),
    subsheetName: typeof b.subsheetName === "string" ? b.subsheetName : null,
    fields,
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// Fallback builder: filled sheet → map, then compose preview fields by slots
// ────────────────────────────────────────────────────────────────────────────────
async function fetchFilledSheetMap(sheetId: number): Promise<Map<number, FilledField>> {
  const r = await fetch(`/api/backend/filledsheets/${sheetId}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) return new Map();

  const json = (await r.json()) as FilledSheetResponse;

  // pick array without nested ternaries
  let arr: ReadonlyArray<Record<string, unknown>> = [];
  if (Array.isArray(json.items)) {
    arr = json.items;
  } else if (Array.isArray(json.fields)) {
    arr = json.fields;
  }

  const readId = (o: Record<string, unknown>): number | null => {
    const upper = (o as { InfoTemplateID?: unknown }).InfoTemplateID;
    const lower = (o as { infoTemplateId?: unknown }).infoTemplateId;
    return asFiniteNumber(upper ?? lower);
  };

  const readLabel = (o: Record<string, unknown>): string => {
    const upper = (o as { Label?: unknown }).Label;
    if (typeof upper === "string") return upper;
    const lower = (o as { label?: unknown }).label;
    return typeof lower === "string" ? lower : "";
  };

  const readValuePair = (o: Record<string, unknown>): { raw: string | null; str: string } => {
    const v =
      (o as { Value?: unknown }).Value ??
      (o as { value?: unknown }).value ??
      null;
    if (typeof v === "string") return { raw: v, str: v };
    if (typeof v === "number") {
      const s = String(v);
      return { raw: s, str: s };
    }
    return { raw: null, str: "" };
  };

  const readUom = (o: Record<string, unknown>): string | undefined => {
    const upper = (o as { UOM?: unknown }).UOM;
    if (typeof upper === "string") return upper;
    const lower = (o as { uom?: unknown }).uom;
    return typeof lower === "string" ? lower : undefined;
  };

  const readOptionalString = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;

  const readOptionalIndex = (v: unknown): number | undefined =>
    asFiniteNumber(v) ?? undefined;

  const map = new Map<number, FilledField>();

  for (const o of arr) {
    const id = readId(o);
    if (id == null) continue;

    const label = readLabel(o);
    const { raw, str } = readValuePair(o);
    const uom = readUom(o);
    const groupKey = readOptionalString((o as { groupKey?: unknown }).groupKey);
    const cellIndex = readOptionalIndex((o as { cellIndex?: unknown }).cellIndex);
    const cellCaption = readOptionalString((o as { cellCaption?: unknown }).cellCaption);

    map.set(id, {
      infoTemplateId: id,
      label,
      valueStr: str,
      rawValue: raw,
      uom,
      groupKey,
      cellIndex,
      cellCaption,
    });
  }

  return map;
}

function buildBlockFromSlotsAndFilledMap(params: {
  layoutId: string;
  subId: number;
  subsheetTitle: string | null;
  slots: SlotsResponse;
  filled: Map<number, FilledField>;
}): RenderBlock | null {
  const { subId, subsheetTitle, slots, filled } = params;
  const ids = [...slots.left, ...slots.right];
  if (ids.length === 0) return null;

  const fields: PreviewRenderField[] = [];

  for (const id of ids) {
    if (!Number.isFinite(id)) continue;

    const f = filled.get(id);
    const label = f?.label ?? "";

    // explicit branch (no nested ternary)
    let columnNumber: 1 | 2 | undefined = undefined;
    if (slots.left.includes(id)) {
      columnNumber = 1;
    } else if (slots.right.includes(id)) {
      columnNumber = 2;
    }

    fields.push({
      infoTemplateId: id,
      label,
      value: f?.valueStr ?? "",
      rawValue: f?.rawValue ?? null,
      uom: f?.uom,
      groupKey: f?.groupKey,
      cellIndex: f?.cellIndex,
      cellCaption: f?.cellCaption,
      columnNumber,
    });
  }

  return {
    subsheetId: subId,
    subsheetName: subsheetTitle,
    fields,
  };
}

// ────────────────────────────────────────────────────────────────────────────────
/** Orchestration helpers to keep load() simple */
// ────────────────────────────────────────────────────────────────────────────────
function createRenderPromise(
  sheetIdNum: number | null,
  layoutId: string,
  sid: number,
  uom: "SI" | "USC",
  lang: "en" | "fr"
): Promise<RenderBlock | null> {
  if (typeof sheetIdNum === "number") {
    return fetchRenderBlockForSubsheet({ layoutId, subId: sid, sheetId: sheetIdNum, uom, lang });
  }
  return Promise.resolve(null);
}

async function buildFallbackBlock(
  sheetIdNum: number | null,
  title: string | null,
  slotCfg: SlotsResponse,
  layoutId: string,
  sid: number
): Promise<RenderBlock | null> {
  if (typeof sheetIdNum !== "number") return null;
  const filled = await fetchFilledSheetMap(sheetIdNum);
  return buildBlockFromSlotsAndFilledMap({
    layoutId,
    subId: sid,
    subsheetTitle: title,
    slots: slotCfg,
    filled,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
/** Hook */
// ────────────────────────────────────────────────────────────────────────────────
export function useSubsheetBuilderData({ layoutId, subId }: Params) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [sheetTitle, setSheetTitle] = React.useState<string | null>(null);
  const [subsheetTitle, setSubsheetTitle] = React.useState<string | null>(null);

  const [slots, setSlots] = React.useState<SlotsResponse>({ left: [], right: [], merged: false });
  const [renderBlock, setRenderBlock] = React.useState<RenderBlock | null>(null);

  // Match Preview defaults; wire these to UI toggles if needed later.
  const uom = "SI" as const;
  const lang = "en" as const;

  React.useEffect(() => {
    let abort = false;

    async function load() {
      setLoading(true);

      // Early validate to reduce branches inside try
      const sid = Number(subId);
      if (!Number.isFinite(sid)) {
        setError("Invalid subsheet id");
        setLoading(false);
        return;
      }

      try {
        // 1) Fetch base meta (sheetId + sheet title)
        const meta = await fetchLayoutMeta(layoutId);
        if (abort) return;
        setSheetTitle(meta.sheetTitle);

        // 2) Prepare tasks
        const renderPromise = createRenderPromise(meta.sheetId, layoutId, sid, uom, lang);
        const structureTitlePromise = fetchSubsheetTitle(layoutId, sid);
        const slotsPromise = fetchSlots(layoutId, subId);

        // 3) Run in parallel
        const [title, slotCfg, block] = await Promise.all([
          structureTitlePromise,
          slotsPromise,
          renderPromise,
        ]);
        if (abort) return;

        if (title) setSubsheetTitle(title);
        setSlots(slotCfg);

        // 4) Prefer /render result if it has fields; otherwise synthesize fallback
        const hasFields = (b: RenderBlock | null): b is RenderBlock =>
          !!b && Array.isArray(b.fields) && b.fields.length > 0;

        const finalBlock: RenderBlock | null = hasFields(block)
          ? block
          : await buildFallbackBlock(meta.sheetId, title ?? null, slotCfg, layoutId, sid);

        if (abort) return;

        setRenderBlock(finalBlock);
        setError(null);
      } catch (e) {
        if (!abort) setError(e instanceof Error ? e.message : "Failed to load subsheet builder data.");
      } finally {
        if (!abort) setLoading(false);
      }
    }

    void load();
    return () => {
      abort = true;
    };
  }, [layoutId, subId, uom, lang]);

  const previewConfig = React.useMemo(() => buildConfigFromSlots(slots), [slots]);

  return {
    loading,
    error,
    sheetTitle,
    subsheetTitle,
    renderBlock,
    previewConfig,
  };
}
