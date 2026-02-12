// src/app/(admin)/datasheets/layouts/[layoutId]/builder/BuilderClient.tsx
"use client";
import { useRouter } from "next/navigation";
import React from "react";
import Image from "next/image";
import type { LayoutBundle, LayoutBlock, LayoutRegion } from "@/domain/layouts/layoutTypes";
import styles from "./BuilderClient.module.css";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
}
const API_BASE = baseUrl;

// ---- modal + error helper --------------------------------------------
type ModalState = Readonly<{
  open: boolean;
  kind: "success" | "error";
  title: string;
  message: string;
}>;

type BodySlotRowOut = {
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2 | null;
  rowNumber: number | null;
  width: 1 | 2;
};

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

interface Props {
  readonly layoutId: number;
}

type AvailableSubsheets = Array<{ id: number; name: string }>;
type AvailableFields = Array<{ id: number; label: string; subId?: number }>;

interface TemplateStructure {
  subsheets: AvailableSubsheets;
  fields: AvailableFields;
}

// Values that can be either a non-empty string, a finite number, or null
type StrNumOrNull = string | number | null;

function toStrNumOrNull(val: unknown): StrNumOrNull {
  const n = toNumber(val);
  if (typeof n === "number") return n;
  const s = toNonEmptyString(val);
  if (typeof s === "string") return s;
  return null;
}

function toText(val: unknown): string | null {
  const s = toNonEmptyString(val);
  if (s != null) return s;
  const n = toNumber(val);
  return typeof n === "number" ? String(n) : null;
}

function toUrl(val: unknown): string | null {
  const s = toNonEmptyString(val);
  if (!s) return null;
  return s;
}

// ---- small parsing helpers (no `any`) ----
// Safe narrow for unknown objects
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}
function toNonEmptyString(val: unknown): string | undefined {
  return typeof val === "string" && val.trim() !== "" ? val : undefined;
}

function isBodySlotRowOut(v: unknown): v is BodySlotRowOut {
  if (!isRecord(v)) return false;

  // v is now Record<string, unknown>
  const o = v;

  const si = Number(o["slotIndex"]);
  const ss = Number(o["subsheetId"]);

  const cnRaw = o["columnNumber"];
  const rnRaw = o["rowNumber"];

  const w = Number(o["width"]);

  const cnOk = cnRaw === null || cnRaw === 1 || cnRaw === 2;
  const rnOk = rnRaw === null || Number.isInteger(Number(rnRaw));
  const wOk  = w === 1 || w === 2;

  return Number.isInteger(si) && si >= 0 &&
         Number.isInteger(ss) && ss > 0 &&
         cnOk && rnOk && wOk;
}

function pickBodySlots(json: unknown): BodySlotRowOut[] {
  if (Array.isArray(json)) {
    return json.filter(isBodySlotRowOut);
  }
  if (!isRecord(json)) {
    return [];
  }

  // Extract potential arrays without nested ternaries
  const fromSlots = json["slots"];
  const fromData  = json["data"];

  let arr: unknown[] = [];
  if (Array.isArray(fromSlots)) {
    arr = fromSlots;
  } else if (Array.isArray(fromData)) {
    arr = fromData;
  }

  return arr.filter(isBodySlotRowOut);
}

// ── Header view-model ─────────────────────────────────────────────────────────
type HeaderVM = Readonly<{
  isTemplate: boolean;
  sheetName: string | null;
  sheetDesc: string | null;
  sheetDesc2: string | null;

  clientDocNum: string | number | null;
  clientProjNum: string | number | null;
  clientName: string | null;
  revisionNum: number | null;
  revisionDate: string | null;

  companyDocNum: string | number | null;
  companyProjNum: string | number | null;
  areaName: string | null;
  packageName: string | null;

  preparedBy: string | null;
  preparedDate: string | null;
  verifiedBy: string | null;
  verifiedDate: string | null;
  approvedBy: string | null;
  approvedDate: string | null;

  equipmentName: string | null;
  equipmentTagNum: string | null;
  status: string | null;

  // LEFT [D]
  projectNo: string | null;
  projectName: string | null;
  service: string | null;
  quantityRequired: string | null; // show as text; backend can still send number
  equipmentSize: string | null;
  modelNo: string | null;

  // MIDDLE [E]
  driver: string | null;
  locationDwg: string | null;
  pAndId: string | null;
  installStdDwg: string | null;
  codeStd: string | null;

  // RIGHT [F]
  location: string | null;
  manufacturer: string | null;
  supplier: string | null;
  installationPackNum: string | null;
  categoryName: string | null;

  // Logos
  clientLogoUrl: string | null;
  companyLogoUrl: string | null;
}>;
// -----------------------------------------

export default function BuilderClient({ layoutId }: Readonly<Props>) {
  const [bundle, setBundle] = React.useState<LayoutBundle | null>(null);
  const router = useRouter();
  const [dragging, setDragging] = React.useState<number | null>(null);

  // Modal for Save success/error (native <dialog>)
  const [modal, setModal] = React.useState<ModalState>({
    open: false,
    kind: "success",
    title: "",
    message: "",
  });
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  // Template structure for “Available” list
  const [templateStructure, setTemplateStructure] = React.useState<TemplateStructure>({
    subsheets: [],
    fields: [],
  });

  const [savedBodySlots, setSavedBodySlots] = React.useState<BodySlotRowOut[] | null>(null);

  // fetch saved rows once per layout
  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/backend/layouts/${layoutId}/bodyslots`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          if (!abort) setSavedBodySlots([]);
          return;
        }
        const json = (await res.json()) as unknown;    // ← just unknown
        const arr  = pickBodySlots(json);              // ← safe narrowing
        if (!abort) setSavedBodySlots(arr);
      } catch {
        if (!abort) setSavedBodySlots([]);
      }
    })();
    return () => { abort = true; };
  }, [layoutId]);

  // ---- NEW: Slots state model for in-memory builder -------------------------
  type Slot = {
    id: string;          // stable key
    width: 1 | 2;        // single or merged (double width)
    subId?: number;      // assigned subsheet id
    isAuto?: boolean;    // true if created by a merge op
  };

  // Slots model: always keep slots.length === total subsheets
  const [slots, setSlots] = React.useState<Slot[]>([]);

  // ── Header state ──────────────────────────────────────────────────────────────
  const [header, setHeader] = React.useState<HeaderVM | null>(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (modal.open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [modal.open]);

  // ── Fetch header when SheetID is known (from bundle.meta.templateId) ─────────
  React.useEffect(() => {
    let abort = false;

    (async () => {
      const metaUnknown = bundle?.meta as unknown;
      const sheetIdFromMeta = isRecord(metaUnknown) && typeof metaUnknown.sheetId === "number" ? metaUnknown.sheetId : null;
      const sheetId = sheetIdFromMeta ?? bundle?.meta?.templateId ?? null;
      if (!sheetId) return;

      // Adjust these to your real JSON routes feeding the two viewer pages:
      const filledUrls = [
        `${API_BASE}/api/backend/filledsheets/${sheetId}`,
      ];
      const templateUrls = [
        `${API_BASE}/api/backend/templates/${sheetId}`,
      ];

      // Try fetch in order: filled → template
      const tryFetchUnified = async (urls: string[]) => {
        for (const url of urls) {
          try {
            const r = await fetch(url, { credentials: "include", cache: "no-store" });
            if (!r.ok) continue;
            const json = (await r.json()) as Record<string, unknown>;
            let unifiedLike: Record<string, unknown> | null = json;
            if (json && typeof json === "object" && "datasheet" in json) {
              const ds = (json as { datasheet?: unknown }).datasheet;
              unifiedLike = isRecord(ds) ? ds : null;
            }
            return unifiedLike;
          } catch {
            /* continue */
          }
        }
        return null;
      };

      const unified =
        (await tryFetchUnified(filledUrls)) ??
        (await tryFetchUnified(templateUrls));

      if (!unified) return;

      const root: Record<string, unknown> = unified;
      const clientRec = root["client"] as Record<string, unknown> | undefined;
      const companyRec = root["company"] as Record<string, unknown> | undefined;

      // Map UnifiedSheet → HeaderVM using the same fields your viewers display
      const vm: HeaderVM = {
        // already present in your VM; keep your fields too if you rely on them elsewhere
        isTemplate: Boolean(unified.isTemplate ?? unified.IsTemplate),

        // Title block
        sheetName: toNonEmptyString(unified.sheetName) ?? null,
        sheetDesc: toNonEmptyString(unified.sheetDesc) ?? null,
        sheetDesc2: toNonEmptyString(unified.sheetDesc2) ?? null,
        status: toNonEmptyString(unified.status) ?? null,

        // Left panel (client & revision)
        clientDocNum: toStrNumOrNull(unified.clientDocNum),
        clientProjNum: toStrNumOrNull(unified.clientProjectNum), // keep your alias field too if you use it
        clientName: toNonEmptyString(unified.clientName) ?? null,
        revisionNum: toNumber(unified.revisionNum) ?? null,
        revisionDate: toNonEmptyString(unified.revisionDate) ?? null,

        // Right panel (company & approvals)
        companyDocNum: toStrNumOrNull(unified.companyDocNum),
        companyProjNum: toStrNumOrNull(unified.companyProjectNum),
        areaName: toNonEmptyString(unified.areaName) ?? null,
        packageName: toNonEmptyString(unified.packageName) ?? null,
        preparedBy: toNonEmptyString(unified.preparedByName) ?? null,
        preparedDate: toNonEmptyString(unified.preparedByDate) ?? null,
        verifiedBy: toNonEmptyString(unified.verifiedByName) ?? null,
        verifiedDate: toNonEmptyString(unified.verifiedDate) ?? null,
        approvedBy: toNonEmptyString(unified.approvedByName) ?? null,
        approvedDate: toNonEmptyString(unified.approvedDate) ?? null,

        // Equipment shown in your center block now
        equipmentName: toNonEmptyString(unified.equipmentName) ?? null,
        equipmentTagNum: toNonEmptyString(unified.equipmentTagNum) ?? null,

        // Third row (3 columns) — align with Equipment Details fields your viewers render
        projectNo: toText(unified.projectNo ?? unified.clientProjectNum ?? unified.companyProjectNum) ?? null,
        projectName: toText(unified.projectName) ?? null,
        service: toText(unified.serviceName) ?? null,
        quantityRequired: toText(unified.requiredQty) ?? null,
        equipmentSize: toText(unified.equipSize) ?? null,
        modelNo: toText(unified.modelNum) ?? null,

        driver: toText(unified.driver) ?? null,
        locationDwg: toText(unified.locationDwg) ?? null,
        pAndId: toText(unified.pid) ?? null,                   // viewers use "pid" key
        installStdDwg: toText(unified.installDwg) ?? null,     // viewers use "installDwg"
        codeStd: toText(unified.codeStd) ?? null,

        location: toText(unified.itemLocation) ?? null,        // viewers use "itemLocation"
        manufacturer: toText(unified.manuName) ?? null,
        supplier: toText(unified.suppName) ?? null,
        installationPackNum: toText(unified.installPackNum) ?? null,
        categoryName: toText(unified.categoryName) ?? null,

        // Logos: you can expose these in UnifiedSheet; or set a default company logo
        clientLogoUrl:
          toUrl(root["clientLogoUrl"]) ??
          (typeof root["clientLogo"] === "string" && root["clientLogo"].trim()
            ? `/clients/${root["clientLogo"]}`
            : null) ??
          toUrl(clientRec?.["logoUrl"]) ??
          null,
        companyLogoUrl:
          toUrl(root["companyLogoUrl"]) ??
          toUrl(companyRec?.["logoUrl"]) ??
          "/images/logo/SpecVerse750x750.png",
      };

      if (!abort) setHeader(vm);
    })();

    return () => {
      abort = true;
    };
  }, [bundle?.meta]);

  // Track last auto-created slot id for “split” removal rule
  const lastAutoSlotIdRef = React.useRef<string | null>(null);

  // Initialize/restore slots when subsheet count is known, preferring DB rows
  React.useEffect(() => {
    const count = templateStructure.subsheets.length;
    if (count <= 0) return;

    setSlots((prev) => {
      // 2.a) If we have rows from the DB, build the slots from those rows
      if (savedBodySlots && savedBodySlots.length > 0) {
        const ordered = [...savedBodySlots].sort((a, b) => a.slotIndex - b.slotIndex);

        // 👇 ensure we produce Slot objects
        const fromDb: Slot[] = ordered.map((row, i): Slot => ({
          id: `slot-${i}`,
          width: row.width === 2 ? 2 : 1,
          subId: row.subsheetId, // number
        }));

        // 👇 `next` is explicitly Slot[]
        const next: Slot[] = fromDb.slice(0, count);
        while (next.length < count) {
          // subId omitted => `undefined` (matches Slot type)
          next.push({ id: `slot-${next.length}`, width: 1 });
        }
        return next;
      }

      // 2.b) Otherwise, keep user’s prior state if sizes match
      if (prev.length === count) return prev;

      // 2.c) First-time or count changed: grow/shrink while preserving existing
      if (prev.length === 0) {
        // 👇 make an explicit Slot[]
        const init: Slot[] = Array.from({ length: count }, (_, i) => ({
          id: `slot-${i}`,
          width: 1,
          // subId intentionally undefined
        }));
        return init;
      }

      const next: Slot[] = prev.slice(0, count);
      while (next.length < count) {
        next.push({ id: `slot-${next.length}`, width: 1 }); // subId undefined
      }
      return next;
    });
  }, [templateStructure.subsheets.length, savedBodySlots]);

  // --------------------------------------------------------------------------

  // ---- NEW: helpers used by Body slots & merge/split ------------------------
  const buildRowsWithIdx = React.useCallback((src: Slot[]) => {
    const rows: Slot[][] = [];
    const rowIdxs: number[][] = [];
    let i = 0;
    while (i < src.length) {
      const left = src[i];
      if (!left) break;

      if (left.width === 2) {
        rows.push([left]);
        rowIdxs.push([i]); // single merged slot row
        i += 1;
        continue;
      }

      const right = src[i + 1]
      if (right?.width === 1) {
        rows.push([left, right])
        rowIdxs.push([i, i + 1])
        i += 2
      } else {
        rows.push([left])
        rowIdxs.push([i])
        i += 1
      }
    }
    return { rows, rowIdxs };
  }, []);

  const subNameById = React.useCallback((subId: number | undefined): string => {
    if (subId == null) return "";
    const s = templateStructure.subsheets.find((x) => x.id === subId);
    return s ? s.name : `Subsheet #${subId}`;
  }, [templateStructure.subsheets]);

  // Compute unassigned subsheets for the left panel
  const assignedSet = React.useMemo(() => {
    const s = new Set<number>();
    for (const slot of slots) {
      if (typeof slot.subId === "number") s.add(slot.subId);
    }
    return s;
  }, [slots]);

  const unassignedSubsheets = React.useMemo(
    () => templateStructure.subsheets.filter((s) => !assignedSet.has(s.id)),
    [templateStructure.subsheets, assignedSet]
  );

  // From Available → Slot
  function onDragStartFromAvailable(subId: number, e: React.DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData("application/x-specverse-sub", String(subId));
    e.dataTransfer.effectAllowed = "copyMove";
  }

  // From Slot → Anywhere (Available or other Slot)
  const onDragStartFromSlot = React.useCallback(
    (slotIdx: number, subId: number, e: React.DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.setData("application/x-slot-sub", JSON.stringify({ slotIdx, subId }));
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  // Drop to Available: unassign a slot’s subsheet
  function onDropToAvailable(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("application/x-slot-sub");
    if (!payload) return;

    try {
      const { slotIdx } = JSON.parse(payload) as { slotIdx: number; subId: number };
      setSlots((prev) => {
        if (!prev[slotIdx]) return prev;
        const next = prev.slice();
        next[slotIdx] = { ...next[slotIdx], subId: undefined };
        return next;
      });
    } catch {
      /* ignore */
    }
  }

  // Drop to a specific slot index
  const onDropToSlot = React.useCallback(
    (targetIdx: number, e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // 1) From Available → assign (replace if taken)
      const subStr = e.dataTransfer.getData("application/x-specverse-sub");
      if (subStr) {
        const subId = Number(subStr);
        if (!Number.isFinite(subId) || subId <= 0) return;

        setSlots((prev) => {
          const next = prev.slice();
          if (!next[targetIdx]) return prev;

          // Replace target; old sub (if any) returns to Available (derived)
          next[targetIdx] = { ...next[targetIdx], subId };
          return next;
        });
        return;
      }

      // 2) From another slot → move or swap
      const slotPayload = e.dataTransfer.getData("application/x-slot-sub");
      if (slotPayload) {
        try {
          const { slotIdx: srcIdx } = JSON.parse(slotPayload) as { slotIdx: number; subId: number };
          if (srcIdx === targetIdx) return;

          setSlots((prev) => {
            const next = prev.slice();
            const src = next[srcIdx];
            const dst = next[targetIdx];
            if (!src || !dst) return prev;

            const srcId = src.subId;
            const dstId = dst.subId;

            if (srcId == null) return prev;

            // Swap if dst occupied, else move
            next[srcIdx] = { ...src, subId: dstId };
            next[targetIdx] = { ...dst, subId: srcId };
            return next;
          });
        } catch {
          // ignore malformed payload
        }
      }
    },
    [] // state setter 'setSlots' is stable; no other external deps
  );

  // Merge two singles in a row into one width=2 slot, append a new auto slot at end
  const mergeRow = React.useCallback((rowIndex: number) => {
    setSlots((prev) => {
      // ✅ Only take what we use
      const { rowIdxs } = buildRowsWithIdx(prev)
      const idxs = rowIdxs[rowIndex]
      if (idxs?.length !== 2) return prev

      const [leftIdx, rightIdx] = idxs;
      const left = prev[leftIdx];
      const right = prev[rightIdx];

      if (!left || !right || left.width !== 1 || right.width !== 1) return prev;

      const next = prev.slice();

      // Merge: left becomes width=2
      next[leftIdx] = { ...left, width: 2 };

      // Remove right slot entirely
      next.splice(rightIdx, 1);

      // Append a new auto-created empty slot
      const newId = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      next.push({ id: newId, width: 1, isAuto: true });
      lastAutoSlotIdRef.current = newId;

      // Any subsheet that was on the removed right slot becomes unassigned (derived)

      return next;
    });
  }, [buildRowsWithIdx]);

  // Split a merged slot in this row; remove the latest auto-created slot
  const splitRow = React.useCallback((rowIndex: number) => {
    setSlots((prev) => {
      // ✅ Only take what we use
      const { rowIdxs } = buildRowsWithIdx(prev)
      const idxs = rowIdxs[rowIndex]
      if (idxs?.length !== 1) return prev

      const [idx] = idxs
      const merged = prev[idx]
      if (merged?.width !== 2) return prev

      const next = prev.slice()

      // Left stays single; keep its subId in the left
      next[idx] = { ...merged, width: 1 }

      // Insert a new empty single slot as the right half
      const insertedId = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      next.splice(idx + 1, 0, { id: insertedId, width: 1 })

      // Remove the most recently auto-created slot
      let removeIdx = -1
      if (lastAutoSlotIdRef.current) {
        removeIdx = next.findIndex((s) => s.id === lastAutoSlotIdRef.current)
      }
      if (removeIdx < 0) {
        // Fallback: remove the last slot
        removeIdx = next.length - 1
      }
      const removed = next.splice(removeIdx, 1)[0];

      // Clear the marker if we removed that one
      if (removed && removed.id === lastAutoSlotIdRef.current) {
        lastAutoSlotIdRef.current = null
      }

      return next
    });
  }, [buildRowsWithIdx]);

  const onMergeRowClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const idx = Number(e.currentTarget.dataset.rowIndex ?? "-1");
      if (Number.isFinite(idx) && idx >= 0) mergeRow(idx);
    },
    [mergeRow]
  );

  const onSplitRowClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const idx = Number(e.currentTarget.dataset.rowIndex ?? "-1");
      if (Number.isFinite(idx) && idx >= 0) splitRow(idx);
    },
    [splitRow]
  );

  const [saving, setSaving] = React.useState(false);

  // Compute a row/column address for each slot using your existing rows model
  const computeSlotAddresses = React.useCallback(() => {
    const { rows, rowIdxs } = buildRowsWithIdx(slots);

    type Rowed = {
      slotIndex: number;
      columnNumber: 1 | 2;  // when width=2, we’ll store 1
      rowNumber: number;     // 1-based for readability in DB
    };

    const results: Rowed[] = [];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const idxs = rowIdxs[r];

      const rowItems =
        row.length === 1
          ? [{ slotIndex: idxs[0], columnNumber: 1 as const, rowNumber: r + 1 }]
          : [
              { slotIndex: idxs[0], columnNumber: 1 as const, rowNumber: r + 1 },
              { slotIndex: idxs[1], columnNumber: 2 as const, rowNumber: r + 1 },
            ];

      results.push(...rowItems);
    }
    return results;
  }, [buildRowsWithIdx, slots]);

  const onSave = React.useCallback(async () => {
    // 1) Validate filled slots
    if (slots.length === 0) {
      setModal({
        open: true,
        kind: "error",
        title: "Nothing to save",
        message: "There are no slots to persist yet.",
      });
      return;
    }
    const firstEmpty = slots.findIndex((s) => typeof s.subId !== "number");
    if (firstEmpty >= 0) {
      setModal({
        open: true,
        kind: "error",
        title: "Assign all subsheets",
        message: "Please assign every slot before saving the layout.",
      });
      return;
    }

    // 2) Build payload with row/column + width
    const addrs = computeSlotAddresses();
    const payload = slots.map((s, i) => {
      const addr = addrs.find((a) => a.slotIndex === i)!; // safe: 1:1
      return {
        slotIndex: i,
        subsheetId: s.subId as number,
        columnNumber: addr.columnNumber,
        rowNumber: addr.rowNumber,
        width: s.width, // 1 or 2
      };
    });

    // 3) POST to backend
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/backend/layouts/${layoutId}/bodyslots`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slots: payload }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setModal({
        open: true,
        kind: "success",
        title: "Layout saved",
        message: "The subsheet placement was saved successfully.",
      });
    } catch (e) {
      setModal({
        open: true,
        kind: "error",
        title: "Save failed",
        message: `Could not save the layout. ${errorMessage(e)}`,
      });
    } finally {
      setSaving(false);
    }
  }, [layoutId, slots, computeSlotAddresses]);
  // --------------------------------------------------------------------------

  // Keep refs to each region's grid container for measuring during drops (track the GRID <div>)
  const regionRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    let abort = false;
    (async () => {
      const r = await fetch(`${API_BASE}/api/backend/layouts/${layoutId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!r.ok) return;
      const b: LayoutBundle = await r.json();
      if (!abort) setBundle(b);
    })();
    return () => {
      abort = true;
    };
  }, [layoutId]);

  // Fetch template structure for Available list (subsheets only used in UI now)
  React.useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/backend/layouts/${layoutId}/structure`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) return;

        const raw = (await r.json()) as unknown;
        const obj = (raw ?? {}) as Record<string, unknown>;

        const subsheetsRaw = Array.isArray(obj.subsheets) ? (obj.subsheets as unknown[]) : [];
        const fieldsRaw = Array.isArray(obj.fields) ? (obj.fields as unknown[]) : [];

        // Accept { id, name } but also tolerate DB-projection like { SubID, SubName }
        const subsheets: AvailableSubsheets = subsheetsRaw
          .map((s): { id: number; name: string } | null => {
            const rec = (s ?? {}) as Record<string, unknown>;
            const id = toNumber(rec.id) ?? toNumber(rec.SubID);
            if (id === undefined) return null;
            const name =
              toNonEmptyString(rec.name) ??
              toNonEmptyString(rec.SubName) ??
              toNonEmptyString(rec.title) ??
              `Subsheet ${id}`;
            return { id, name };
          })
          .filter((x): x is { id: number; name: string } => x !== null);

        const fields: AvailableFields = fieldsRaw
          .map((f): { id: number; label: string; subId?: number } | null => {
            const rec = (f ?? {}) as Record<string, unknown>;
            const id = toNumber(rec.id) ?? toNumber(rec.InfoTemplateID);
            if (id === undefined) return null;
            const label = toNonEmptyString(rec.label) ?? toNonEmptyString(rec.name) ?? `Field ${id}`;
            const subFromLower = toNumber(rec.subId);
            const subFromUpper = toNumber(rec.SubID);
            const resolvedSubId = subFromLower ?? subFromUpper;
            const field: { id: number; label: string; subId?: number } = { id, label };
            if (resolvedSubId !== undefined) field.subId = resolvedSubId;
            return field;
          })
          .filter((x): x is { id: number; label: string; subId?: number } => x !== null);

        if (!abort) {
          setTemplateStructure({ subsheets, fields });
        }
      } catch {
        // non-fatal; available stays empty
      }
    })();
    return () => {
      abort = true;
    };
  }, [layoutId]);

  // Apply grid CSS variables (no inline styles)
  const applyGridVars = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !bundle) return;
      el.style.setProperty("--grid-cols", String(bundle.meta.gridCols));
      el.style.setProperty("--grid-gap", `${bundle.meta.gridGapMm}px`);
    },
    [bundle]
  );

  // Per-block placement via CSS variables (no inline styles)
  const makeBlockRef = (b: LayoutBlock) => (el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.setProperty("--col-start", String(b.x + 1));
    el.style.setProperty("--col-span", String(Math.max(1, b.w)));
    el.style.setProperty("--row-start", String(b.y + 1));
    el.style.setProperty("--row-span", String(Math.max(1, b.h)));
  };

  // Commit a drop at the given client coordinates (used by mouse and touch)
  const commitDrop = React.useCallback(
    async (region: LayoutRegion, containerEl: HTMLDivElement, clientX: number, clientY: number) => {
      if (!bundle || dragging === null) return;

      const rect = containerEl.getBoundingClientRect();
      const gridCols = bundle.meta.gridCols;
      const cellW = rect.width / gridCols;

      const xPos = clientX - rect.left;
      const yPos = clientY - rect.top;

      const x = Math.max(0, Math.min(gridCols - 1, Math.round(xPos / cellW)));
      const y = Math.max(0, Math.round(yPos / 24)); // row height heuristic

      const block = bundle.blocks.find((blk) => blk.blockId === dragging);
      if (!block) return;

      const updated: Partial<LayoutBlock> = { x, y, regionId: region.regionId };
      const res = await fetch(`${API_BASE}/api/backend/layouts/blocks/${block.blockId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                blocks: prev.blocks.map((blk) =>
                  blk.blockId === block.blockId ? { ...blk, x, y, regionId: region.regionId } : blk
                ),
              }
            : prev
        );
      }
      setDragging(null);
    },
    [bundle, dragging]
  );

  // Place new Subsheet blocks in a 2-column layout by index
  async function addSubsheetAutoPlace(region: LayoutRegion, subId: number) {
    if (!bundle) return;

    // Half width per column (two equal columns)
    const half = Math.max(1, Math.floor(bundle.meta.gridCols / 2));

    // Count existing subsheet blocks in this region to compute next slot
    const existing = bundle.blocks.filter(
      (b) => b.regionId === region.regionId && b.blockType === "Subsheet"
    );
    const index = existing.length;
    const col = index % 2;                       // 0 = left, 1 = right
    const row = Math.floor(index / 2);           // grow by rows
    const x = col * half;
    const y = row;                                // 1 row per subsheet row
    const w = half;
    const h = 1;

    const payload = {
      blockType: "Subsheet" as const,
      sourceRef: { SubID: subId },
      x, y, w, h,
      orderIndex: index,
    };

    const r = await fetch(`${API_BASE}/api/backend/layouts/regions/${region.regionId}/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = (await r.json().catch(() => ({}))) as { blockId?: number };
    if (!r.ok || typeof json.blockId !== "number") return;

    const newBlock: LayoutBlock = {
      blockId: json.blockId,
      regionId: region.regionId,
      blockType: "Subsheet",
      sourceRef: { SubID: subId },
      props: null,
      x, y, w, h,
      orderIndex: index,
    };

    setBundle((prev) => (prev ? { ...prev, blocks: [...prev.blocks, newBlock] } : prev));
  }

  // -------------------------------------------------
  // Width helpers for Subsheet blocks
  async function saveWidth(b: LayoutBlock, w: number) {
    const res = await fetch(`${API_BASE}/api/backend/layouts/blocks/${b.blockId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ w }),
    });
    if (res.ok) {
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              blocks: prev.blocks.map((x) => (x.blockId === b.blockId ? { ...x, w } : x)),
            }
          : prev
      );
    }
  }

  // Size-aware logo renderer (uses next/image width/height; no inline styles)
  const renderLogo = React.useCallback(
    (
      src?: string | null,
      alt?: string,
      size?: { width?: number; height?: number }
    ) => {
      const safeSrc =
        typeof src === "string" && src.trim() ? src : "/images/logo/SpecVerse750x750.png";
      const safeAlt = typeof alt === "string" && alt.trim() ? alt : "Logo";
      const width = size?.width ?? 112;  // ≈ w-28
      const height = size?.height ?? 40; // ≈ h-10

      return (
        <Image
          src={safeSrc}
          alt={safeAlt}
          width={width}
          height={height}
          className="h-auto w-auto object-contain"
          priority
        />
      );
    },
    []
  );

  // ---- NEW: stable render helpers (avoid deep inline functions) -------------
  const renderSlotCell = React.useCallback(
    (slot: Slot, ci: number, r: number, rowIdxs: number[][]): React.ReactElement => {
      const leftNum = r * 2 + 1;
      const rightNum = leftNum + 1;

      let label: string;
      if (slot.width === 2) {
        label = `Slot ${leftNum}–${rightNum}`;
      } else {
        const num = ci === 0 ? leftNum : rightNum;
        label = `Slot ${num}`;
      }

      const slotAbsIdx = rowIdxs[r][ci];

      // ✅ Positive/explicit checks (no "negated condition")
      const hasSub = typeof slot.subId === "number";
      const subName = hasSub ? subNameById(slot.subId as number) : "";

      return (
        <button
          key={slot.id}
          type="button"
          className={`border rounded p-3 text-center text-xs ${
            hasSub ? "bg-white" : "border-dashed text-gray-500"
          } ${slot.width === 2 ? "col-span-2" : ""}`}
          aria-label={hasSub ? `Layout subsheet: ${subName}` : label}
          title={hasSub ? `Layout subsheet: ${subName}` : undefined}
          onClick={() => {
            if (hasSub) {
              router.push(`/datasheets/layouts/${layoutId}/subsheetbuilder/${slot.subId}`);
            }
          }}
          draggable={hasSub}
          onDragStart={(e) => {
            if (hasSub) onDragStartFromSlot(slotAbsIdx, slot.subId as number, e);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.preventDefault();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onDropToSlot(slotAbsIdx, e as React.DragEvent<HTMLElement>)}
        >
          {hasSub ? (
            <span className="inline-block rounded border px-2 py-[2px]">{subName}</span>
          ) : (
            <span>{label}</span>
          )}
        </button>
      );
    },
    [layoutId, router, onDropToSlot, onDragStartFromSlot, subNameById]
  );

  const renderRowCells = React.useCallback(
    (row: Slot[], r: number, rowIdxs: number[][]): React.ReactElement[] => {
      const cells: React.ReactElement[] = [];
      for (let ci = 0; ci < row.length; ci++) {
        cells.push(renderSlotCell(row[ci], ci, r, rowIdxs));
      }
      return cells;
    },
    [renderSlotCell]
  );

  // Extracted render helpers to reduce cognitive complexity of region mapping
  function renderHeaderPreview(): React.ReactElement {
    return (
      <div className="p-3 space-y-3" aria-label="Sheet header preview">
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded p-3">
            <div className="mb-3 flex items-center justify-center gap-4">
              {header?.clientLogoUrl
                ? renderLogo(header.clientLogoUrl, `${header.clientName ?? "Client"} logo`, { width: 60, height: 60 })
                : <span className="text-[11px] text-gray-400">Client Logo</span>}
              {header?.companyLogoUrl
                ? renderLogo(header.companyLogoUrl, "SpecVerse logo", { width: 60, height: 60 })
                : <span className="text-[11px] text-gray-400">SpecVerse Logo</span>}
            </div>
            <div className="text-sm space-y-1">
              <div>Client Doc. N°: <span className="font-medium">{header?.clientDocNum ?? "—"}</span></div>
              <div>Client Project N°: <span className="font-medium">{header?.clientProjNum ?? "—"}</span></div>
              <div>Client Name: <span className="font-medium">{header?.clientName ?? "—"}</span></div>
              <div>Revision: <span className="font-medium">{header?.revisionNum ?? "—"}</span></div>
              <div>Date: <span className="font-medium">{header?.revisionDate ?? "—"}</span></div>
            </div>
          </div>

          <div className="border rounded p-3 text-center">
            <div className="text-lg font-semibold tracking-wide">
              {header?.isTemplate ? "TEMPLATE" : "DATASHEET"}
            </div>
            <div className="mt-1 font-medium">{header?.sheetName ?? "—"}</div>
            {header?.sheetDesc ? <div className="text-sm text-gray-700">{header.sheetDesc}</div> : null}
            {header?.sheetDesc2 ? <div className="text-sm text-gray-700">{header.sheetDesc2}</div> : null}
            {header?.equipmentTagNum ? <div className="text-sm text-gray-700">{header.equipmentTagNum}</div> : null}
            {header?.equipmentName ? <div className="text-sm text-gray-700">{header.equipmentName}</div> : null}
            {header?.status ? <div className="mt-1 text-xs text-gray-500">Status: {header.status}</div> : null}
          </div>

          <div className="border rounded p-3">
            <div className="text-sm space-y-1">
              <div>Company Doc. N°: <span className="font-medium">{header?.companyDocNum ?? "—"}</span></div>
              <div>Company Project N°: <span className="font-medium">{header?.companyProjNum ?? "—"}</span></div>
              <div>Area: <span className="font-medium">{header?.areaName ?? "—"}</span></div>
              <div>Package: <span className="font-medium">{header?.packageName ?? "—"}</span></div>
              <div>Prepared by / Date: <span className="font-medium">
                {(header?.preparedBy ?? "—") + " / " + (header?.preparedDate ?? "—")}
              </span></div>
              <div>Verified by / Date: <span className="font-medium">
                {(header?.verifiedBy ?? "—") + " / " + (header?.verifiedDate ?? "—")}
              </span></div>
              <div>Approved by / Date: <span className="font-medium">
                {(header?.approvedBy ?? "—") + " / " + (header?.approvedDate ?? "—")}
              </span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded p-3">
            <div className="text-sm space-y-1">
              <div>Project No.: <span className="font-medium">{header?.projectNo ?? "—"}</span></div>
              <div>Project Name: <span className="font-medium">{header?.projectName ?? "—"}</span></div>
              <div>Service: <span className="font-medium">{header?.service ?? "—"}</span></div>
              <div>Quantity Rqd: <span className="font-medium">{header?.quantityRequired ?? "—"}</span></div>
              <div>Equip. Size: <span className="font-medium">{header?.equipmentSize ?? "—"}</span></div>
              <div>Model N°: <span className="font-medium">{header?.modelNo ?? "—"}</span></div>
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="text-sm space-y-1">
              <div>Driver: <span className="font-medium">{header?.driver ?? "—"}</span></div>
              <div>Location Dwg: <span className="font-medium">{header?.locationDwg ?? "—"}</span></div>
              <div>P&amp;ID: <span className="font-medium">{header?.pAndId ?? "—"}</span></div>
              <div>Install Std / Dwg: <span className="font-medium">{header?.installStdDwg ?? "—"}</span></div>
              <div>Code / Std.: <span className="font-medium">{header?.codeStd ?? "—"}</span></div>
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="text-sm space-y-1">
              <div>Location: <span className="font-medium">{header?.location ?? "—"}</span></div>
              <div>Manufacturer: <span className="font-medium">{header?.manufacturer ?? "—"}</span></div>
              <div>Supplier: <span className="font-medium">{header?.supplier ?? "—"}</span></div>
              <div>Installation Pack N°: <span className="font-medium">{header?.installationPackNum ?? "—"}</span></div>
              <div>Category: <span className="font-medium">{header?.categoryName ?? "—"}</span></div>
              <div>Status: <span className="font-medium">{header?.status ?? "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDynamicBodyRegion(region: LayoutRegion): React.ReactElement | null {
    if (region.kind !== "dynamic") return null;

    const { rows, rowIdxs } = buildRowsWithIdx(slots);

    return (
      <div className="mb-3 px-3">
        <div className="text-xs text-gray-500 mb-2">
          Drag subsheets from the left into these slots. Two columns. Slot count always equals total subsheets.
        </div>

        <div className="space-y-2" aria-label="Slot layout">
          {rows.map((row, r) => {
            const idxs = rowIdxs[r];
            const twoSingles = row.length === 2 && slots[idxs[0]].width === 1 && slots[idxs[1]].width === 1;
            const isMerged = row.length === 1 && slots[idxs[0]].width === 2;

            const rowKey = row.map((s) => s.id).join("|");

            let action: React.ReactNode = null;
            if (twoSingles) {
              action = (
                <button
                  type="button"
                  className="text-[11px] rounded border px-2 py-[2px]"
                  data-row-index={r}
                  onClick={onMergeRowClick}
                  title="Merge this row's two single slots"
                >
                  Merge row
                </button>
              );
            } else if (isMerged) {
              action = (
                <button
                  type="button"
                  className="text-[11px] rounded border px-2 py-[2px]"
                  data-row-index={r}
                  onClick={onSplitRowClick}
                  title="Split this merged row into two singles"
                >
                  Split row
                </button>
              );
            }

            return (
              <div key={`row-${rowKey}`} className="grid grid-cols-2 gap-3 items-start">
                <div className="col-span-2 flex justify-end gap-2 -mb-1">{action}</div>
                {renderRowCells(row, r, rowIdxs)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderRegion(region: LayoutRegion): React.ReactElement {
    const regionNameLower = (region.name ?? "").toLowerCase();
    const isHeader = regionNameLower === "header";

    return (
      <section key={region.regionId} className="border rounded" aria-label={`${region.name} area`}>
        <div className="px-3 py-2 text-sm bg-gray-50 border-b">{region.name}</div>

        {isHeader ? (
          renderHeaderPreview()
        ) : (
          <>
            {renderDynamicBodyRegion(region)}

            {/* Existing drop zone (unchanged) */}
            <section
              className="relative block w-full p-3 text-left"
              aria-label={`${region.name} drop zone`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const gridEl = regionRefs.current.get(region.regionId);
                if (!gridEl) return;
                e.preventDefault();

                const subStr = e.dataTransfer.getData("application/x-specverse-sub");
                if (subStr) {
                  const subId = Number(subStr);
                  if (Number.isFinite(subId) && subId > 0) {
                    void addSubsheetAutoPlace(region, subId);
                    return;
                  }
                }

                void commitDrop(region, gridEl, e.clientX, e.clientY);
              }}
            >
              <div
                id={`grid-${region.regionId}`}
                className={styles.grid}
                ref={(el) => {
                  applyGridVars(el);
                  if (el) {
                    regionRefs.current.set(region.regionId, el);
                  } else {
                    regionRefs.current.delete(region.regionId);
                  }
                }}
              >
                {bundle!.blocks
                  .filter((b) => b.regionId === region.regionId)
                  .map((b) => (
                    <div key={b.blockId} ref={makeBlockRef(b)} className={styles.block}>
                      <div className="font-medium mb-1">{b.blockType}</div>
                      <div className="text-[11px] text-gray-600">
                        x:{b.x} y:{b.y} w:{b.w} h:{b.h}
                      </div>

                      {b.blockType === "Subsheet" && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-[11px] text-gray-500 mr-1">Width:</span>
                          <button
                            type="button"
                            className="text-[11px] rounded border px-2 py-[2px]"
                            onClick={() => void saveWidth(b, bundle!.meta.gridCols)}
                            title="Full width"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            className="text-[11px] rounded border px-2 py-[2px]"
                            onClick={() => void saveWidth(b, Math.max(1, Math.floor(bundle!.meta.gridCols / 2)))}
                            title="Half width"
                          >
                            1/2
                          </button>
                          <button
                            type="button"
                            className="text-[11px] rounded border px-2 py-[2px]"
                            onClick={() => void saveWidth(b, Math.max(1, Math.floor(bundle!.meta.gridCols / 4)))}
                            title="Quarter width"
                          >
                            1/4
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}
      </section>
    );
  }
  // --------------------------------------------------------------------------

  if (!bundle) return <div className="p-6">Loading layout…</div>;

  return (
    <div className="grid grid-cols-12 gap-4 p-4">
      {/* Left pane: Available + Placed */}
      <aside className="col-span-2 border rounded p-3 space-y-4">
        <div>
          <h2 className="font-semibold mb-2">Available SubSheets</h2>
          {/* Available Subsheets (drag onto Body slots; drop here to unassign) */}
          {/* // Available panel */}
          <div className="mb-3">
            <div className="mb-1 text-[11px] text-gray-500">
              Total: {templateStructure.subsheets.length} • Unassigned: {unassignedSubsheets.length}
            </div>

            <section
              className="rounded border p-2"
              aria-label="Drop here to unassign a subsheet"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropToAvailable}
            >
              {unassignedSubsheets.length === 0 ? (
                <div className="text-xs text-gray-500">None</div>
              ) : (
                <ul className="space-y-1">
                  {unassignedSubsheets.map((s) => (
                    <li key={`avail-sub-${s.id}`} className="flex items-center justify-between">
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStartFromAvailable(s.id, e)}
                        className="text-left w-full cursor-grab rounded border px-2 py-[2px] text-sm"
                        aria-label={`Drag ${s.name} onto a slot`}
                        title="Drag onto a slot"
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </aside>

      {/* Canvas (right) */}
      <main className="col-span-10 space-y-3">
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:hover:bg-neutral-800"
            onClick={() => router.push(`/datasheets/layouts/${layoutId}/preview`)}
          >
            Preview Datasheet
          </button>

          {(() => {
            const busyAttrs = saving ? ({ "aria-busy": "true" } as const) : undefined;
            return (
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 dark:hover:bg-neutral-800"
                onClick={onSave}
                disabled={saving}
                {...busyAttrs}
              >
                {saving ? "Saving…" : "Save Layout"}
              </button>
            );
          })()}
        </div>
        {bundle.regions.map(renderRegion)}
      </main>
    </div>
  );
}
