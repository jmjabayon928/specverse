/**
 * SpecVerse Preview (refactor split) — Performance-safe
 * Strict TypeScript, no `any`. Pure functions + small components.
 * This file is part of: /datasheets/layouts/[layoutId]/preview
 */

// usePreviewData.ts
"use client";
import React from "react";

export type UomSystem = "SI" | "USC";
export type LangCode = "en";

export type RenderField = Readonly<{
  infoTemplateId: number;
  label: string;
  value: string;
  rawValue: string | null;
  uom?: string;
  groupKey?: string;
  cellIndex?: number;
  cellCaption?: string;
  columnNumber?: 1 | 2;
}>;

export type RenderBlock = Readonly<{
  subsheetId: number;
  subsheetName: string;
  fields: ReadonlyArray<RenderField>;
}>;

type RenderHeaderVM = Readonly<{
  equipmentTag?: string | null;
  equipmentName?: string | null;
  project?: string | null;
  fields: ReadonlyArray<RenderField>;
}>;

export type RenderPayload = Readonly<{
  layoutId: number;
  sheetId: number;
  uom: UomSystem;
  lang: LangCode;
  header: RenderHeaderVM;
  body: ReadonlyArray<RenderBlock>;
}>;

export type LayoutBundle = Readonly<{
  meta: Readonly<{ layoutId: number; templateId: number | null; sheetId?: number }>;
  regions: unknown[];
  blocks: unknown[];
}>;

export type BodySlot = Readonly<{
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2;
  rowNumber: number;
  width: 1 | 2;
}>;

export type SubsheetSlotsConfig = Readonly<{
  merged: boolean;
  left: ReadonlyArray<{ index: number; infoTemplateId: number }>;
  right: ReadonlyArray<{ index: number; infoTemplateId: number }>;
}>;

export type HeaderVM = Readonly<{
  clientLogoUrl?: string | null;
  companyLogoUrl?: string | null;
  clientName?: string | null;
  clientDocNum?: string | number | null;
  clientProjNum?: string | number | null;
  revisionNum?: number | null;
  revisionDate?: string | null;
  isTemplate?: boolean;
  sheetName?: string | null;
  sheetDesc?: string | null;
  sheetDesc2?: string | null;
  equipmentTagNum?: string | null;
  equipmentName?: string | null;
  status?: string | null;
  companyDocNum?: string | number | null;
  companyProjNum?: string | number | null;
  areaName?: string | null;
  packageName?: string | null;
  preparedBy?: string | null;
  preparedDate?: string | null;
  verifiedBy?: string | null;
  verifiedDate?: string | null;
  approvedBy?: string | null;
  approvedDate?: string | null;
  projectNo?: string | null;
  projectName?: string | null;
  service?: string | null;
  quantityRequired?: string | number | null;
  equipmentSize?: string | null;
  modelNo?: string | null;
  driver?: string | null;
  locationDwg?: string | null;
  pAndId?: string | null;
  installStdDwg?: string | null;
  codeStd?: string | null;
  location?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  installationPackNum?: string | null;
  categoryName?: string | null;
}>;

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
}
const API_BASE = baseUrl;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s || null;
  }
  return null;
}
function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = asString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

type Indexable = Readonly<Record<string, unknown>>;
const isIndexable = (v: unknown): v is Indexable => typeof v === "object" && v !== null;

const pickArrayProp = (obj: Indexable, keys: ReadonlyArray<string>): unknown[] | null => {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return null;
};

const pushInfoValue = (
  out: Map<number, { value: string; uom: string | null }>,
  tid: unknown,
  val: unknown,
  u: unknown
): void => {
  const id = asNumber(tid);
  const valueStr = asString(val);
  const uomStr = asString(u);
  if (id != null && valueStr != null && valueStr.trim() !== "") {
    out.set(id, { value: valueStr, uom: uomStr ?? null });
  }
};

const pushFromRec = (
  out: Map<number, { value: string; uom: string | null }>,
  rec: Indexable
): void => {
  const tid = rec["InfoTemplateID"] ?? rec["infoTemplateId"];
  const val = rec["InfoValue"] ?? rec["infoValue"] ?? rec["value"];
  const uom = rec["UOM"] ?? rec["uom"];
  pushInfoValue(out, tid, val, uom);
};

function asStrOrNum(v: unknown): string | number | null {
  const n = asNumber(v);
  if (n !== null) return n;
  const s = asString(v);
  return s;
}
function asUrl(v: unknown): string | null {
  const s = asString(v);
  return s || null;
}
function kvFromRenderFields(fields: ReadonlyArray<RenderField>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const k = f.label?.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    if (k && typeof f.value === "string" && f.value.trim() !== "") out[k] = f.value.trim();
  }
  return out;
}
async function fetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!r.ok) return null;
  return r.json();
}
function unwrapDatasheet(json: unknown): Record<string, unknown> | null {
  if (!isRecord(json)) return null;
  if (isRecord(json.datasheet)) return json.datasheet;
  return json;
}

export function parseBodySlots(j: unknown): BodySlot[] {
  if (!isRecord(j) || !Array.isArray(j.slots)) return [];
  const out: BodySlot[] = [];
  for (const raw of j.slots as unknown[]) {
    if (!isRecord(raw)) continue;
    const slotIndex = Number(raw.slotIndex);
    const subsheetId = Number(raw.subsheetId);
    const colRaw = Number(raw.columnNumber);
    const row = Number(raw.rowNumber);
    const widthRaw = Number(raw.width);
    if (!Number.isFinite(slotIndex) || !Number.isFinite(subsheetId) || !Number.isFinite(row)) continue;
    const columnNumber: 1 | 2 = colRaw === 2 ? 2 : 1;
    const width: 1 | 2 = widthRaw === 2 ? 2 : 1;
    out.push({ slotIndex, subsheetId, columnNumber, rowNumber: row, width });
  }
  return out;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function extractEntriesArray(raw: unknown): unknown[] {
  if (typeof raw !== "object" || raw === null) return [];
  const obj = raw as Record<string, unknown>;
  const candidates = [obj.subsheets, obj.blocks, raw];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function isBadName(name: string): boolean {
  const s = name.trim().toLowerCase();
  return !s || s === "subsheet" || s === "subsheetid" || s === "id" || /^\d+$/.test(s);
}

export function parseSubsheetMap(raw: unknown): Record<number, string> {
  const map: Record<number, string> = {};
  for (const it of extractEntriesArray(raw)) {
    if (typeof it !== "object" || it === null) continue;
    const rec = it as Record<string, unknown>;

    const id =
      num(rec.subsheetId) ??
      num(rec.SubsheetID) ??
      num(rec.id);

    const nm =
      str(rec.subsheetName) ??
      str(rec.SubsheetName) ??
      str(rec.title) ??
      str(rec.caption) ??
      str(rec.name);

    if (id !== null && nm && !isBadName(nm)) {
      map[id] = nm;
    }
  }
  return map;
}

// 2) Add a helper to merge names from payload.body:
function mergeNamesFromPayload(
  base: Record<number, string>,
  payload: RenderPayload | null
): Record<number, string> {
  if (!payload) return base;
  const merged: Record<number, string> = { ...base };
  for (const b of payload.body) {
    if (!merged[b.subsheetId] && b.subsheetName) {
      merged[b.subsheetId] = b.subsheetName;
    }
  }
  return merged;
}

export async function loadSubsheetLayoutConfig(
  layoutId: number,
  subId: number
): Promise<SubsheetSlotsConfig | null> {
  // ───────────────────────── helpers ─────────────────────────
  type SlotLite = { index: number; infoTemplateId: number };

  const asNumber = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const isCol12 = (n: unknown): n is 1 | 2 => {
    const val = asNumber(n);
    return val === 1 || val === 2;
  };

  const pickOrder = (it: Record<string, unknown>): number | undefined => {
    // Prefer DB-driven order
    const cands = [it.orderInColumn, it.OrderInColumn, it.order, it.index, it.slotIndex, it.position];
    for (const c of cands) {
      const n = asNumber(c);
      if (n !== undefined) return n;
    }
    return undefined;
  };

  const pickTid = (it: Record<string, unknown>): number | undefined => {
    const cands = [it.infoTemplateId, it.InfoTemplateID, it.infoTemplateID, it.templateId];
    for (const c of cands) {
      const n = asNumber(c);
      if (n !== undefined) return n;
    }
    return undefined;
  };

  const pickCol = (it: Record<string, unknown>): 1 | 2 | undefined => {
    const cands = [it.columnNumber, it.ColumnNumber, it.column, it.col, it.ColNum];
    for (const c of cands) if (isCol12(c)) return c;
    return undefined;
  };

  const sortAndReindex = (arr: Array<{ order: number; infoTemplateId: number }>): SlotLite[] => {
    arr.sort((a, b) => a.order - b.order);
    return arr.map((x, i) => ({ index: i, infoTemplateId: x.infoTemplateId }));
  };

  const normArr = (arr: unknown): SlotLite[] => {
    const a = Array.isArray(arr) ? arr : [];
    const tmp: Array<{ order: number; infoTemplateId: number }> = [];
    for (const raw of a) {
      if (typeof raw !== "object" || raw === null) continue;
      const it = raw as Record<string, unknown>;
      const ord = pickOrder(it);
      const tid = pickTid(it);
      if (ord === undefined || tid === undefined) continue;
      tmp.push({ order: ord, infoTemplateId: tid });
    }
    return sortAndReindex(tmp);
  };

  const parseLeftRightShape = (json: unknown): SubsheetSlotsConfig | null => {
    if (!json || typeof json !== "object") return null;
    if (!("left" in json) && !("right" in json)) return null;

    const merged = Boolean((json as { merged?: unknown }).merged);
    const left = normArr((json as { left?: unknown }).left);
    const right = normArr((json as { right?: unknown }).right);
    return (left.length + right.length) > 0 ? { merged, left, right } : null;
  };

  const parseFlatListShape = (json: unknown): SubsheetSlotsConfig | null => {
    let list: unknown[] = [];
    if (json && typeof json === "object" && Array.isArray((json as { slots?: unknown }).slots)) {
      list = (json as { slots: unknown[] }).slots;
    } else if (Array.isArray(json)) {
      list = json as unknown[];
    }
    if (list.length === 0) return null;

    type RawItem = { order: number; infoTemplateId: number; column: 1 | 2 };
    const leftRaw: RawItem[] = [];
    const rightRaw: RawItem[] = [];

    for (const raw of list) {
      if (typeof raw !== "object" || raw === null) continue;
      const it = raw as Record<string, unknown>;
      const tid = pickTid(it);
      const col = pickCol(it);
      const ord = pickOrder(it);
      if (tid === undefined || col === undefined || ord === undefined) continue;
      const item: RawItem = { order: ord, infoTemplateId: tid, column: col };
      (col === 1 ? leftRaw : rightRaw).push(item);
    }

    const left = sortAndReindex(leftRaw);
    const right = sortAndReindex(rightRaw);
    return (left.length + right.length) > 0 ? { merged: false, left, right } : null;
  };

  const parseFromLocalStorage = (): SubsheetSlotsConfig | null => {
    try {
      const ls = localStorage.getItem(`sv:subsheet:${layoutId}:${subId}:slots`);
      const mergedFlag = localStorage.getItem(`sv:subsheet:${layoutId}:${subId}:merged`) === "1";
      if (!ls) return null;

      const parsed = JSON.parse(ls) as {
        merged?: boolean;
        left?: Array<number | null>;
        right?: Array<number | null>;
      };

      const leftIds = (parsed.left ?? []).filter((n): n is number => typeof n === "number");
      const rightIds = (parsed.right ?? []).filter((n): n is number => typeof n === "number");

      const left = leftIds.map((id, index) => ({ index, infoTemplateId: id }));
      const right = rightIds.map((id, index) => ({ index, infoTemplateId: id }));
      return { merged: parsed.merged ?? mergedFlag, left, right };
    } catch {
      return null;
    }
  };

  // ───────────────────────── network ─────────────────────────
  try {
    const r = await fetch(`${API_BASE}/api/backend/layouts/${layoutId}/subsheets/${subId}/slots`, {
      credentials: "include",
      cache: "no-store",
    });
    if (r.ok) {
      const json = await r.json();
      // Prefer explicit left/right; otherwise parse flat list
      const asLR = parseLeftRightShape(json);
      if (asLR) return asLR;
      const asFlat = parseFlatListShape(json);
      if (asFlat) return asFlat;
    }
  } catch {
    // ignore and fall back
  }

  // ─────────────────────── local fallback ─────────────────────
  return parseFromLocalStorage();
}

export function usePreviewData(layoutId: number) {
  const [bundle, setBundle] = React.useState<LayoutBundle | null>(null);
  const [payload, setPayload] = React.useState<RenderPayload | null>(null);
  const [slots, setSlots] = React.useState<ReadonlyArray<BodySlot>>([]);
  const [subNameMap, setSubNameMap] = React.useState<Record<number, string>>({});
  const [headerUnified, setHeaderUnified] = React.useState<HeaderVM | null>(null);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [subsheetLayouts, setSubsheetLayouts] = React.useState<Record<string, SubsheetSlotsConfig>>({});
  const [uom] = React.useState<UomSystem>("SI");
  const [lang] = React.useState<LangCode>("en");

  // Bundle
  React.useEffect(() => {
    let abort = false;
    (async () => {
      setErr(null);
      try {
        const r = await fetch(`${API_BASE}/api/backend/layouts/${layoutId}`, { credentials: "include", cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as unknown;
        if (abort) return;
        if (isRecord(json) && isRecord(json.meta)) setBundle(json as LayoutBundle);
        else setErr("Invalid layout bundle.");
      } catch (e) {
        if (!abort) setErr(e instanceof Error ? e.message : "Failed to load layout bundle.");
      }
    })();
    return () => { abort = true; };
  }, [layoutId]);

  const getSheetIdFromBundle = React.useCallback((): number | null => {
    const meta = bundle?.meta;
    if (!meta) return null;
    if (typeof meta.sheetId === "number" && Number.isFinite(meta.sheetId)) return meta.sheetId;
    if (typeof meta.templateId === "number" && Number.isFinite(meta.templateId)) return meta.templateId;
    return null;
  }, [bundle]);

  // Render payload
  React.useEffect(() => {
    let abort = false;
    (async () => {
      if (!bundle) return;
      const sid = getSheetIdFromBundle();
      if (!sid) { setPayload(null); setErr("No sheet/template id available."); return; }
      setBusy(true); setErr(null);
      try {
        const url = new URL(`${API_BASE}/api/backend/layouts/${layoutId}/render`);
        url.searchParams.set("sheetId", String(sid));
        url.searchParams.set("uom", uom);
        url.searchParams.set("lang", lang);
        const r = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as RenderPayload;
        if (!abort) setPayload(json);
      } catch (e) {
        if (!abort) { setPayload(null); setErr(e instanceof Error ? e.message : "Failed to load preview render."); }
      } finally {
        if (!abort) setBusy(false);
      }
    })();
    return () => { abort = true; };
  }, [bundle, layoutId, getSheetIdFromBundle, uom, lang]);

  const infoValueMap: Map<number, { value: string; uom: string | null }> = React.useMemo(() => {
    const out = new Map<number, { value: string; uom: string | null }>();
    if (!headerUnified) return out;

    // helpers (keep near the other small utils)
    const headerToArray = (h: unknown): unknown[] | null => {
      if (Array.isArray(h)) return h;
      if (isIndexable(h)) {
        return pickArrayProp(h, ["informationValues", "InformationValues", "values", "Values"]);
      }
      return null;
    };

    const pushArrayIntoMap = (
      arr: unknown[] | null,
      out: Map<number, { value: string; uom: string | null }>
    ): void => {
      if (!arr) return;
      for (const it of arr) {
        if (isIndexable(it)) pushFromRec(out, it);
      }
    };

    // refactored function (low complexity)
    const tryFromHeader = (h: unknown): void => {
      const arr = headerToArray(h);
      pushArrayIntoMap(arr, out);
    };

    tryFromHeader(headerUnified);

    // Optional: some backends embed values deeper, e.g., headerUnified.sheet/inventory/etc.
    // Add extra picks here if needed:
    // if (isIndexable(headerUnified) && isIndexable(headerUnified["sheet"])) {
    //   tryFromHeader(headerUnified["sheet"]);
    // }

    return out;
  }, [headerUnified]);

  const payloadWithValues: RenderPayload | null = React.useMemo(() => {
    if (!payload) return null;

    if (infoValueMap.size === 0) return payload;

    const map = infoValueMap;

    const fixField = (f: RenderField): RenderField => {
      const filled = map.get(f.infoTemplateId);
      const hasValue = f.value != null && String(f.value).trim() !== "";
      const nextValue = hasValue ? f.value : (filled?.value ?? f.value);
      const nextUom = f.uom ?? filled?.uom ?? undefined;

      if (nextValue === f.value && nextUom === f.uom) return f;

      return {
        ...f,
        value: typeof nextValue === "number" ? nextValue : (nextValue ?? ""),
        uom: nextUom,
      };
    };

    const nextBody = payload.body.map(b => ({
      ...b,
      fields: b.fields.map(fixField),
    }));

    // If your header needs value overlay too, do it here similarly.
    const nextHeader = payload.header;

    return { ...payload, header: nextHeader, body: nextBody };
  }, [payload, infoValueMap]);

  // Slots + names
  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const [slotsJson, structureJson] = await Promise.all([
          fetchJson(`${API_BASE}/api/backend/layouts/${layoutId}/bodyslots`),
          fetchJson(`${API_BASE}/api/backend/layouts/${layoutId}/structure`),
        ]);
        if (abort) return;

        setSlots(parseBodySlots(slotsJson));

        const baseNames = parseSubsheetMap(structureJson);
        // merge in names from payload.body (if available)
        const merged = mergeNamesFromPayload(baseNames, payload);
        setSubNameMap(merged);
      } catch (e) {
        if (!abort) setErr(e instanceof Error ? e.message : "Failed to load body slots/structure.");
      }
    })();
    return () => { abort = true; };
  }, [layoutId, payload]);

  // Ensure subNameMap always has names from the render payload
  React.useEffect(() => {
    if (!payload) return;
    setSubNameMap(prev => {
      const next = { ...prev };
      for (const b of payload.body) {
        if (b.subsheetName && !next[b.subsheetId]) {
          next[b.subsheetId] = b.subsheetName;
        }
      }
      return next;
    });
  }, [payload, setSubNameMap]);

  // Unified header
  React.useEffect(() => {
    let abort = false;
    (async () => {
      if (!bundle) return;
      const sheetId = getSheetIdFromBundle();
      if (!sheetId) return;
      const tryFetchUnified = async (urls: string[]) => {
        for (const u of urls) {
          try {
            const r = await fetch(u, { credentials: "include", cache: "no-store" });
            if (!r.ok) continue;
            const json = (await r.json()) as unknown;
            const unwrapped = unwrapDatasheet(json);
            if (unwrapped) return unwrapped;
          } catch { /* next */ }
        }
        return null;
      };
      const unified =
        (await tryFetchUnified([`${API_BASE}/api/backend/filledsheets/${sheetId}`, `${API_BASE}/api/backend/filledsheets/${sheetId}?v=2`])) ??
        (await tryFetchUnified([`${API_BASE}/api/backend/templates/${sheetId}`]));
      if (!unified) return;

      const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
      const clientRec = isRec(unified.client) ? unified.client : undefined;
      const companyRec = isRec(unified.company) ? unified.company : undefined;

      const vm: HeaderVM = {
        clientLogoUrl: asUrl(unified.clientLogoUrl) ?? (asString(unified.clientLogo) ? `/clients/${String(unified.clientLogo)}` : null) ?? asUrl(clientRec?.logoUrl) ?? null,
        companyLogoUrl: asUrl(unified.companyLogoUrl) ?? asUrl(companyRec?.logoUrl) ?? "/images/logo/SpecVerse750x750.png",
        clientName: asString(unified.clientName) ?? null,
        clientDocNum: asStrOrNum(unified.clientDocNum),
        clientProjNum: asStrOrNum(unified.clientProjectNum),
        revisionNum: asNumber(unified.revisionNum),
        revisionDate: asString(unified.revisionDate) ?? null,
        isTemplate: Boolean(unified.isTemplate),
        sheetName: asString(unified.sheetName) ?? null,
        sheetDesc: asString(unified.sheetDesc) ?? null,
        sheetDesc2: asString(unified.sheetDesc2) ?? null,
        equipmentTagNum: asString(unified.equipmentTagNum) ?? null,
        equipmentName: asString(unified.equipmentName) ?? null,
        status: asString(unified.status) ?? null,
        companyDocNum: asStrOrNum(unified.companyDocNum),
        companyProjNum: asStrOrNum(unified.companyProjectNum),
        areaName: asString(unified.areaName) ?? null,
        packageName: asString(unified.packageName) ?? null,
        preparedBy: asString(unified["preparedByName"]) ?? asString(unified.preparedBy) ?? null,
        preparedDate: asString(unified["preparedByDate"]) ?? asString(unified.preparedDate) ?? null,
        verifiedBy: asString(unified["verifiedByName"]) ?? asString(unified.verifiedBy) ?? null,
        verifiedDate: asString(unified.verifiedDate) ?? null,
        approvedBy: asString(unified["approvedByName"]) ?? asString(unified.approvedBy) ?? null,
        approvedDate: asString(unified.approvedDate) ?? null,
        projectNo: asString(unified.projectNo) ?? null,
        projectName: asString(unified.projectName) ?? null,
        service: asString(unified.service) ?? null,
        quantityRequired: asStrOrNum(unified.quantityRequired),
        equipmentSize: asString(unified.equipmentSize) ?? null,
        modelNo: asString(unified.modelNo) ?? null,
        driver: asString(unified.driver) ?? null,
        locationDwg: asString(unified.locationDwg) ?? null,
        pAndId: asString(unified.pAndId) ?? asString(unified["p&id"]) ?? null,
        installStdDwg: asString(unified.installStdDwg) ?? null,
        codeStd: asString(unified.codeStd) ?? null,
        location: asString(unified.itemLocation) ?? asString(unified.location) ?? null,
        manufacturer: asString(unified.manuName) ?? asString(unified.manufacturer) ?? null,
        supplier: asString(unified.suppName) ?? asString(unified.supplier) ?? null,
        installationPackNum: asString(unified.installPackNum) ?? asString(unified.installationPackNum) ?? null,
        categoryName: asString(unified.categoryName) ?? null,
      };
      if (!abort) setHeaderUnified(vm);
    })();
    return () => { abort = true; };
  }, [bundle, getSheetIdFromBundle]);

  // header from /render
  const headerFromRender: HeaderVM = React.useMemo(() => {
    if (!payload) return {};
    const m = kvFromRenderFields(payload.header.fields);
    const isTemplate = Boolean(bundle?.meta?.templateId);
    return {
      clientLogoUrl: null,
      companyLogoUrl: null,
      clientDocNum: m["clientdocn"] ?? m["clientdocnum"] ?? null,
      clientProjNum: m["clientprojectn"] ?? m["clientprojectnum"] ?? null,
      clientName: m["clientname"] ?? null,
      revisionNum: asNumber(m["revision"] ?? m["revisionnum"]),
      revisionDate: m["date"] ?? m["revisiondate"] ?? null,
      isTemplate,
      sheetName: m["sheetname"] ?? payload.header.project ?? null,
      sheetDesc: m["sheetdesc"] ?? null,
      sheetDesc2: m["sheetdesc2"] ?? null,
      equipmentTagNum: payload.header.equipmentTag ?? null,
      equipmentName: payload.header.equipmentName ?? null,
      status: m["status"] ?? null,
      companyDocNum: m["companydocn"] ?? m["companydocnum"] ?? null,
      companyProjNum: m["companyprojectn"] ?? m["companyprojectnum"] ?? null,
      areaName: m["area"] ?? m["areaname"] ?? null,
      packageName: m["package"] ?? m["packagename"] ?? null,
      preparedBy: m["preparedby"] ?? null,
      preparedDate: m["prepareddate"] ?? null,
      verifiedBy: m["verifiedby"] ?? null,
      verifiedDate: m["verifieddate"] ?? null,
      approvedBy: m["approvedby"] ?? null,
      approvedDate: m["approveddate"] ?? null,
      projectNo: m["projectno"] ?? null,
      projectName: m["projectname"] ?? null,
      service: m["service"] ?? null,
      quantityRequired: m["qtyrequired"] ?? m["quantityrequired"] ?? null,
      equipmentSize: m["equipmentsize"] ?? null,
      modelNo: m["modelno"] ?? null,
      driver: m["driver"] ?? null,
      locationDwg: m["locationdwg"] ?? null,
      pAndId: m["p&id"] ?? m["pandd"] ?? m["pandid"] ?? null,
      installStdDwg: m["installstddwg"] ?? null,
      codeStd: m["codestd"] ?? null,
      location: m["location"] ?? null,
      manufacturer: m["manufacturer"] ?? null,
      supplier: m["supplier"] ?? null,
      installationPackNum: m["installationpackno"] ?? m["installpackno"] ?? null,
      categoryName: m["categoryname"] ?? null,
    };
  }, [payload, bundle?.meta?.templateId]);

  const header: HeaderVM = React.useMemo(
    () => headerUnified ?? headerFromRender,
    [headerFromRender, headerUnified]
  );

  // subsheet layouts
  React.useEffect(() => {
    if (!payload) return;
    let abort = false;

    (async () => {
      const ids = Array.from(
        new Set(
          payload.body
            .map(b => Number(b.subsheetId))
            .filter((n): n is number => Number.isFinite(n))
        )
      );

      const results = await Promise.all(ids.map(id => loadSubsheetLayoutConfig(layoutId, id)));
      if (abort) return;

      setSubsheetLayouts((prev) => {
        const next = { ...prev };
        for (const [i, id] of ids.entries()) {
          const cfg = results[i];
          if (cfg && (cfg.left.length + cfg.right.length) > 0) {
            next[id.toString()] = cfg;
          }
        }
        return next;
      });
    })();

    return () => { abort = true; };
  }, [layoutId, payload]);

  return { bundle, payload: payloadWithValues, slots, subNameMap, header, subsheetLayouts, busy, err };
}
