# Calnetic SpecVerse — Datasheet Layout & Rendering Architecture

**Status:** Draft (v1)  
**Owners:** Platform team (SpecVerse / Calnetic)  
**Last updated:** 2025-10-16

---

## 1) Purpose

This document defines how SpecVerse represents and renders datasheets of *any* discipline (process, mechanical, electrical, etc.), including:
- Page-level layout (arranging subsheets into a 2-column body with merge/split rows).
- Subsheet-level layout (arranging information templates inside each subsheet).
- A new `caseMatrix` subsheet kind to support “Design / Nominal / Turndown” style tables.
- Read-only header hydration and export (PDF/Excel).
- Minimal, incremental DB/API changes that don’t break existing flows.

The goal is to keep **working parts as-is**, add **small, typed patches**, and enable growth to all datasheet families.

---

## 2) Terms

- **Sheet / Datasheet** — A document for an equipment or system instance (or a template).
- **Subsheet** — A logical section of a datasheet (e.g., OPERATING CONDITIONS, SEAL).
- **InfoTemplate** — A field/row definition used inside a subsheet (label, uom, options…).
- **Body slot** — A visual slot in the page body where a subsheet is placed.
- **Subsheet slot** — A visual slot *inside* a subsheet where an InfoTemplate is placed.

---

## 3) Page Layout (Body) — Current + Saved

### 3.1 Overview
- Builder displays two equal columns of slots per row. Two adjacent slots can be **merged** to span both columns (`width=2`).
- Subsheets are dragged from the left palette into body slots.
- We **persist** the arrangement per layout.

### 3.2 Persistence schema

```sql
-- Existing and in use
CREATE TABLE dbo.LayoutBodySlots (
  LayoutID      INT NOT NULL,
  SlotIndex     INT NOT NULL,           -- 0..N-1 visual order
  SubsheetID    INT NOT NULL,
  ColumnNumber  INT NULL,               -- 1 or 2 (optional; for analytics/layout tools)
  RowNumber     INT NULL,               -- 1..K (optional)
  Width         INT NOT NULL DEFAULT 1, -- 1 (single col) or 2 (merged)
  CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_LayoutBodySlots PRIMARY KEY (LayoutID, SlotIndex),
  CONSTRAINT FK_LBS_DatasheetLayouts FOREIGN KEY (LayoutID) REFERENCES dbo.DatasheetLayouts(LayoutID),
  CONSTRAINT FK_LBS_Subsheets        FOREIGN KEY (SubsheetID)   REFERENCES dbo.Subsheets(SubID)
);
```

- `SlotIndex` is the canonical visual order (left→right, top→bottom).
- `Width=2` indicates a merged, full-row slot.

### 3.3 REST

```
GET  /api/backend/layouts/:layoutId/bodyslots
POST /api/backend/layouts/:layoutId/bodyslots
```

**Request body (POST):**
```json
{
  "slots": [
    { "slotIndex": 0, "subsheetId": 68, "columnNumber": 1, "rowNumber": 1, "width": 1 },
    { "slotIndex": 1, "subsheetId": 69, "columnNumber": 2, "rowNumber": 1, "width": 1 },
    { "slotIndex": 2, "subsheetId": 70, "columnNumber": 1, "rowNumber": 2, "width": 1 }
  ]
}
```

**Response:**
```json
{ "ok": true, "count": 3 }
```

---

## 4) Subsheet Layout (Inside a Subsheet)

### 4.1 UX/Behavior
- **Two equal columns** of slots by default: `ceil(N/2)` on the left, `floor(N/2)` on the right where `N` = number of InfoTemplates in that subsheet.  
- Can **merge** into a single column; can **split** back to two.  
- Drag/drop supports: palette → slot, slot ↔ slot swap, slot → palette (remove).  
- A11y: native controls, labeled buttons, keyboard removal (Delete/Backspace), no inline styles.

### 4.2 Persistence
- **In-memory** (LocalStorage) by default:
  - `sv:subsheet:<layoutId>:<subId>:slots`
  - `sv:subsheet:<layoutId>:<subId>:merged`
- **Optional table** (deferred until needed):
```sql
CREATE TABLE dbo.LayoutSubsheetSlots (
  LayoutID        INT NOT NULL,
  SubsheetID      INT NOT NULL,
  SlotIndex       INT NOT NULL,
  InfoTemplateID  INT NOT NULL,
  ColumnNumber    INT NULL,      -- 1 or 2 (when split), or 1 when merged
  RowNumber       INT NULL,
  CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_LayoutSubsheetSlots PRIMARY KEY (LayoutID, SubsheetID, SlotIndex),
  CONSTRAINT FK_LSS_Layouts        FOREIGN KEY (LayoutID)       REFERENCES dbo.DatasheetLayouts(LayoutID),
  CONSTRAINT FK_LSS_Subsheets      FOREIGN KEY (SubsheetID)     REFERENCES dbo.Subsheets(SubID),
  CONSTRAINT FK_LSS_InfoTemplates  FOREIGN KEY (InfoTemplateID) REFERENCES dbo.InformationTemplates(InfoTemplateID)
);
```

### 4.3 REST (palette)
```
GET /api/backend/subsheets/:subId/infotemplates
```

**Response:**
```json
{ "templates": [ { "InfoTemplateID": 123, "Label": "Flow rate" }, ... ] }
```

*(Saving subslot layout to DB can be added later as `PUT /layouts/:layoutId/subsheets/:subId/slots`.)*

---

## 5) New Subsheet Kind: `caseMatrix`

### 5.1 Why
Several specs require “label + multi-case columns (Design/Nominal/Turndown) + optional units + remarks” layouts.

### 5.2 Template model (JSON-first; minimal diff)
Store in `SubSheets.ConfigJSON` and tag `SubSheets.Kind='caseMatrix'`.

```json
{
  "kind": "caseMatrix",
  "title": "PROCESS DATA",
  "columns": {
    "cases": ["Design Case", "Nominal Case", "Turndown Case"],
    "includeUnits": true,
    "includeRemarks": true
  },
  "rows": [
    { "type": "section", "label": "VAPOR PHASE" },
    {
      "type": "field",
      "key": "vapor.actualFlowRate",
      "label": "Actual Flow Rate",
      "uom": "kg/hr",
      "valuesByCase": { "Design Case": "", "Nominal Case": "", "Turndown Case": "" },
      "remarks": null
    },
    { "type": "section", "label": "HC LIQUID PHASE" },
    {
      "type": "field",
      "key": "hc.densityPt",
      "label": "Density @ P, T",
      "uom": "kg/m³",
      "valuesByCase": { "Design Case": "", "Nominal Case": "", "Turndown Case": "" },
      "remarks": null
    }
  ]
}
```

### 5.3 Rendering rules
- First column = labels; optional second column = Units; then one `<th>` per case; optional last column = Remarks.
- Rows:
  - `section` spans all columns with bold caption.
  - `field` renders label + unit + cells per case + optional remarks.
- **UOM**: On the fly conversion (SI→USC) per row using existing converter.

### 5.4 Frontend (React, simplified renderer)
```ts
export type CaseMatrix = {
  kind: "caseMatrix";
  title?: string;
  columns: { cases: string[]; includeUnits?: boolean; includeRemarks?: boolean };
  rows: (
    | { type: "section"; label: string }
    | { type: "field"; key: string; label: string; uom?: string;
        valuesByCase: Record<string, string | number | null>; remarks?: string | null }
  )[];
};
```

*(Renderer lives with other subsheet renderers. PDF/Excel add a corresponding branch.)*

---

## 6) Header Hydration (Read-only)

We keep the existing **HeaderVM** used by the Builder header preview and Filled viewer. If `/sheets/:sheetId/header` doesn’t exist, create a light controller/service that joins `Sheets + lookups` and returns:

```json
{
  "IsTemplate": 0,
  "SheetName": "ROTARY PUMP",
  "SheetDesc": "…",
  "SheetDesc2": "…",
  "ClientName": "ACME",
  "ClientDocNum": "CD-42",
  "ClientProjNum": "PR-1001",
  "RevisionNum": 2,
  "RevisionDate": "2025-09-29",
  "CompanyDocNum": "SV-987",
  "CompanyProjNum": "SV-654",
  "AreaName": "Process A",
  "PackageName": "PKG-01",
  "PreparedByName": "J. Smith",
  "PreparedByDate": "2025-09-10",
  "VerifiedByName": "M. Lee",
  "VerifiedByDate": "2025-09-12",
  "ApprovedByName": "R. Cruz",
  "ApprovedByDate": "2025-09-14",
  "EquipmentName": "Pump P-101A",
  "EquipmentTagNum": "P-101A",
  "Status": "Approved",
  "ClientLogoUrl": "/logos/acme.png",
  "CompanyLogoUrl": "/images/logo/SpecVerse750x750.png"
}
```

The Builder now fetches layout meta → template/sheet id → header endpoint and renders real values.

---

## 7) Scaling Headers for All Disciplines

### 7.1 Keep `Sheets` as a slim core
Essential, cross-domain columns only: identity, naming, revisions, people/dates, doc nums, logos, status, template linkage.

**Suggested core (keep):**
- `SheetID (PK)`, `TemplateID (FK)`, `ClientID`, `ProjectID`, `ParentSheetID (nullable)`,  
  `SheetName`, `SheetDesc`, `SheetDesc2`,  
  `RevisionNum`, `RevisionDate`, `PreparedByID/Date`, `VerifiedByID/Date`, `ApprovedByID/Date`,  
  `ClientDocNum`, `ClientProjNum`, `CompanyDocNum`, `CompanyProjNum`,  
  `Status`, `IsLatest`, `IsTemplate`, `IsSuperseded`, `RejectComment`, `ModifiedByID/Date`,  
  *(Optional in core)*: `ClientLogoUrl`, `CompanyLogoUrl`.

> **De-emphasize/deprecate** equipment-specific columns in `Sheets` (e.g., `EquipSize`, `ModelNum`, `Driver`, etc.). They move to KV (below) or typed domain tables.

### 7.2 Add flexible header store (no schema churn)

```sql
CREATE TABLE dbo.SheetHeaderKV (
  SheetID    INT NOT NULL,
  FieldKey   NVARCHAR(64) NOT NULL,   -- e.g. "EquipmentName", "EquipmentTagNum", "ServiceName", "PID"
  FieldValue NVARCHAR(MAX) NULL,
  UOM        NVARCHAR(32) NULL,
  SortOrder  INT NULL,
  CONSTRAINT PK_SheetHeaderKV PRIMARY KEY (SheetID, FieldKey),
  CONSTRAINT FK_SheetHeaderKV_Sheets FOREIGN KEY (SheetID) REFERENCES dbo.Sheets(SheetID)
);
```

- API merges `Sheets` + `SheetHeaderKV` into `HeaderVM`.
- Future: add strict domain tables (e.g., `PumpHeaders`) for heavy hitters — hybrid approach.

---

## 8) Routes Summary

```
# Layout meta (existing)
GET  /api/backend/layouts/:layoutId
GET  /api/backend/layouts/:layoutId/structure
PUT  /api/backend/layouts/:layoutId

# Body slots (page builder)
GET  /api/backend/layouts/:layoutId/bodyslots
POST /api/backend/layouts/:layoutId/bodyslots

# Subsheet palette (left list)
GET  /api/backend/subsheets/:subId/infotemplates

# (Optional) Persist subsheet slots
PUT  /api/backend/layouts/:layoutId/subsheets/:subId/slots

# Header (read-only)
GET  /api/backend/sheets/:sheetId/header
# or
GET  /api/backend/templates/:sheetId/header
```

All routes protected with `verifyToken`.

---

## 9) Frontend Conventions

- **A11y:** native `<button>`, correct `aria-*`, keyboard operable, no inline styles, valid labels.
- **Lint:** no array index keys, no nested ternaries, stable callbacks with `useCallback`, use `next/image` for logos.
- **LocalStorage keys (subsheet builder):**
  - `sv:subsheet:<layoutId>:<subId>:slots`
  - `sv:subsheet:<layoutId>:<subId>:merged`

---

## 10) Export

- **PDF**: existing generator + new branch for `caseMatrix`.
- **Excel**: mirror the same table shape (labels | units | cases… | remarks), one worksheet per subsheet if large.

---

## 11) Migration Plan

1. **Keep everything working** (no breaking changes).
2. Add `LayoutBodySlots` (done) and wire `GET/POST` (done).
3. Enable Subsheet Builder (palette + local in-memory; DB persistence optional).
4. Introduce `caseMatrix` in templates (one subsheet first).
5. Add `SheetHeaderKV` and start reading from it (write later).
6. Gradually deprecate niche columns in `Sheets`.

---

## 12) Minimal Controller/Service Snippets

**List info templates (already added via layout controller):**
```ts
// GET /api/backend/subsheets/:subId/infotemplates
export const getSubsheetInfoTemplates: RequestHandler = async (req, res) => {
  const subId = Number(req.params.subId);
  if (!Number.isFinite(subId) || subId <= 0) return res.status(400).json({ error: "Invalid subId" });

  try {
    const list = await layoutService.listInfoTemplatesBySubId(subId);
    return res.json({ templates: list });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load info templates" });
  }
};
```

**Body slots (save/list):**
```ts
// POST /api/backend/layouts/:layoutId/bodyslots
export const saveLayoutBodySlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  if (!Number.isFinite(layoutId) || layoutId <= 0) return res.status(400).json({ error: "Invalid layoutId" });

  const slots = Array.isArray(req.body?.slots) ? req.body.slots : null;
  if (!slots) return res.status(400).json({ error: "Payload must include slots: []" });

  const normalized: BodySlotRow[] = [];
  for (const row of slots as unknown[]) {
    if (!row || typeof row !== "object") return res.status(400).json({ error: "Bad row" });
    const o = row as Record<string, unknown>;
    const slotIndex = Number(o.slotIndex);
    const subsheetId = Number(o.subsheetId);
    const columnNumber = Number(o.columnNumber);
    const rowNumber = Number(o.rowNumber);
    const width = Number(o.width);

    if (!Number.isInteger(slotIndex) || slotIndex < 0)  return res.status(400).json({ error: "Invalid slotIndex" });
    if (!Number.isInteger(subsheetId) || subsheetId <= 0) return res.status(400).json({ error: "Invalid subsheetId" });
    if (!(columnNumber === 1 || columnNumber === 2))     return res.status(400).json({ error: "Invalid columnNumber" });
    if (!Number.isInteger(rowNumber) || rowNumber <= 0)  return res.status(400).json({ error: "Invalid rowNumber" });
    if (!(width === 1 || width === 2))                   return res.status(400).json({ error: "Invalid width" });

    normalized.push({ slotIndex, subsheetId, columnNumber: columnNumber as 1 | 2, rowNumber, width: width as 1 | 2 });
  }

  try {
    await layoutService.saveLayoutBodySlots(layoutId, normalized);
    return res.json({ ok: true, count: normalized.length });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save body slots" });
  }
};

// GET /api/backend/layouts/:layoutId/bodyslots
export const getLayoutBodySlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  if (!Number.isFinite(layoutId) || layoutId <= 0) return res.status(400).json({ error: "Invalid layoutId" });
  try {
    const rows = await layoutService.listLayoutBodySlots(layoutId);
    return res.json({ slots: rows });
  } catch {
    return res.status(500).json({ error: "Failed to load body slots" });
  }
};
```

**Service (save):**
```ts
export async function saveLayoutBodySlots(layoutId: number, rows: BodySlotRow[]): Promise<void> {
  const db = await poolPromise;
  const tx = new sql.Transaction(db);
  await tx.begin();

  try {
    await new sql.Request(tx)
      .input("layoutId", sql.Int, layoutId)
      .query("DELETE FROM dbo.LayoutBodySlots WHERE LayoutID = @layoutId");

    const sorted = [...rows].sort((a, b) => a.slotIndex - b.slotIndex);
    for (const r of sorted) {
      await new sql.Request(tx)
        .input("layoutId",     sql.Int, layoutId)
        .input("slotIndex",    sql.Int, r.slotIndex)
        .input("subsheetId",   sql.Int, r.subsheetId)
        .input("columnNumber", sql.Int, r.columnNumber)
        .input("rowNumber",    sql.Int, r.rowNumber)
        .input("width",        sql.Int, r.width)
        .query(`
          INSERT INTO dbo.LayoutBodySlots
            (LayoutID, SlotIndex, SubsheetID, ColumnNumber, RowNumber, Width)
          VALUES
            (@layoutId, @slotIndex, @subsheetId, @columnNumber, @rowNumber, @width)
        `);
    }

    await tx.commit();
  } catch (error_) {
    await tx.rollback();
    throw error_;
  }
}
```

---

## 13) Non-Goals

- No DB writes for header hydration in the Builder task (read-only fetch + render).
- No breaking changes to existing drag/drop logic.

---

## 14) Open Questions / Next

- When to persist Subsheet Builder to DB (vs local only)?  
- Which domains need strict typed header tables first (pump, vessel, HX, MCC)?  
- Versioning of templates/subsheets (locking layout with a given revision).

---

## 15) Appendix — Types

```ts
// Page body layout (client <-> server)
export type BodySlotRow = {
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2;
  rowNumber: number;
  width: 1 | 2;
};
export type BodySlotRowOut = BodySlotRow;

// Subsheet palette item
export type InfoTemplate = { InfoTemplateID: number; Label: string };

// Case matrix VM
export type CaseMatrixRow =
  | { type: "section"; label: string }
  | { type: "field"; key: string; label: string; uom?: string;
      valuesByCase: Record<string, string | number | null>; remarks?: string | null };

export type CaseMatrix = {
  kind: "caseMatrix";
  title?: string;
  columns: { cases: string[]; includeUnits?: boolean; includeRemarks?: boolean };
  rows: CaseMatrixRow[];
};
```

---

## 16) Visual/UX Notes

- **Subsheet Builder header:** `Subsheet Builder • Sheet: <SheetName> • Subsheet: <SubsheetName>`
- Helper text: “Drag Information from the left into these slots. Two columns. Slot count always equals total Information.”
- **Modal** components are rendered **portaled at document.body** with `z-50` (Tailwind) to sit above sidebars.

---

*End of document.*

---

## 17) Layout Builder vs. Datasheet Mirror (Preview)

### 17.1 Roles
- **Layout Builder (Authoring):** Interactive tool to design placement. Writes to layout tables (`DatasheetLayouts`, `LayoutRegions`, `LayoutBlocks`, `LayoutBodySlots`, optionally `LayoutSubsheetSlots`).
- **Datasheet Mirror (Preview):** Read-only renderer that shows the datasheet **with resolved values**. Reads from `Sheets`, `Subsheets`, `InformationTemplates`, `InformationValues` **and** the chosen layout; exports PDF/Excel.

They overlap in structure and rendering, but serve different user intents. Keep both; share the rendering engine.

### 17.2 Unified Rendering Engine
Introduce a common server-side **RenderTree** that both modules consume.

```ts
export type RenderTree = {
  header: HeaderVM;
  regions: Array<{
    regionId: number;
    kind: "header" | "dynamic" | "footer";
    blocks: Array<{
      blockId: number;
      type: "Subsheet" | "RichText" | "Spacer" | "Table";
      frame: { x: number; y: number; w: number; h: number };
      content: unknown; // resolved data the React/PDF layer can paint
    }>;
  }>;
};
```

**Endpoint (new):**
```
GET /api/backend/layouts/:layoutId/render?sheetId=...&uom=SI|USC&lang=en
```
- Builds `HeaderVM` (as in §6).
- Reads layout (`LayoutBodySlots`, etc.).
- Resolves values (`InformationValues`) and template structure into `content` blocks.
- Returns a pure RenderTree that the **Preview UI**, **PDF**, and **Excel** can all consume.

### 17.3 “Promote to Layout” from Mirror
Optionally let Mirror persist an arrangement back to layout tables:
```
POST /api/backend/layouts/:layoutId/promote
```
- Body contains a minimal arrangement payload (e.g., array of `{ slotIndex, subsheetId, width }` and optional subsheet inner slot map if you’re persisting `LayoutSubsheetSlots`).
- Server upserts into `LayoutBodySlots` (and `LayoutSubsheetSlots` if provided).

### 17.4 Feature Matrix

| Capability | Builder | Mirror |
|---|---|---|
| Drag subsheets into body | ✅ | ❌ |
| Drag info templates within subsheet | ✅ | ❌ |
| Merge/split columns in subsheet | ✅ | ❌ |
| Change block widths (full/½/¼) | ✅ | ❌ |
| Read header values (Sheets) | ✅ | ✅ |
| Resolve values (InformationValues) | ☐ optional | ✅ |
| Honor layout (all tables) | ✅ | ✅ |
| Export (PDF/Excel) | ☐ via button | ✅ |
| “Promote to Layout” | — | ✅ (optional action) |

### 17.5 Frontend Notes
- **Mirror Viewer** is read-only and consumes `RenderTree`.  
- **Builder** can optionally embed a small “Live Preview” pane by calling the same `/render` endpoint.

### 17.6 Why not merge the screens?
- Keeping authoring separate from preview avoids accidental edits and simplifies permissions.  
- Sharing the renderer guarantees WYSIWYG parity between Builder, Mirror, and exports.

