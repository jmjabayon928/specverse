# Phase 2: Discovery, File Plan, and Migration Plan

**Stop point:** After this document and migration scripts, implementation (backend C, frontend D, tests E) waits for approval.

---

## A) Discovery (repo-specific)

### A.1 Current tables used for filled sheet values

| Table | Usage |
|-------|--------|
| **dbo.InformationValues** | Primary store for per-field values on filled sheets. All read/write of filled-sheet field data goes through this table. |
| **dbo.InformationTemplates** | Field definitions (Label, InfoType, UOM, Required); joined to get structure and labels; not modified by Phase 2. |
| **dbo.SubSheets** | Subsheet structure per sheet; joined to resolve SubID/SheetID for templates and values. |
| **dbo.Sheets** | Sheet metadata; TemplateID links filled sheet to template. |

No existing tables for ValueContexts, Parties, or InformationValueSets were found in the repo; the migration will create ValueContexts and InformationValueSets. **Parties** is assumed to exist elsewhere (e.g. reference data); migration does not create it.

### A.2 InformationValues columns (from code)

**Primary path (create/update filled sheet, get for edit, layout render):**

- **InfoTemplateID** (int) — FK to InformationTemplates.
- **SheetID** (int) — FK to Sheets.
- **InfoValue** (varchar(max)) — single value; used in all INSERT/SELECT in `filledSheetService.ts`, `informationQueries.ts`, `layoutService.ts`, `statsService.ts`, `datasheetQueries.ts`.
- **UOM** (nullable) — read in `informationQueries.ts` (V.UOM), `layoutService.ts` (v.UOM), `filledSheetService.ts` (IT.UOM from join). Current INSERT in `filledSheetService` does **not** write UOM (only InfoTemplateID, SheetID, InfoValue). Phase 2 prefill will copy “value + UOM” as specified; if UOM column exists on InformationValues, include it in COPY.

**Revision path (revisionService only):**

- **RevisionID** (int, nullable) — used in layoutService ORDER BY and in revisionService.
- **InfoValue1**, **UOM1**, **InfoValue2**, **UOM2** — used only in `revisionService.ts` for duplicating values to a new revision. Phase 2 migration does not change these columns; legacy rows may keep RevisionID; new Phase 2 rows use ValueSetID and may leave RevisionID NULL.

**Conclusion:** For Phase 2 we add **ValueSetID** (nullable, FK to InformationValueSets). Prefill copies **InfoTemplateID**, **InfoValue**, and **UOM** (if column exists) from Requirement set to Offered set. No change to RevisionID/InfoValue1/UOM1/InfoValue2/UOM2 in this migration.

### A.3 Endpoints that read/write filled sheet values

| Method | Route | Controller | Service | Purpose |
|--------|--------|------------|---------|---------|
| GET | `/api/backend/filledsheets/:id` | getFilledSheetById | getFilledSheetDetailsById | Load sheet + subsheets + field values (single set; Phase 1 = implicit Requirement). |
| PUT | `/api/backend/filledsheets/:id` | updateFilledSheetHandler | updateFilledSheet | Replace all InformationValues for sheet (Phase 1: by SheetID). |
| POST | `/api/backend/filledsheets/` | createFilledSheetHandler | createFilledSheet | Create sheet + SubSheets + InformationTemplates + InformationValues (Phase 1: one value per field). |
| POST | `/api/backend/filledsheets/:id/clone` | cloneFilledSheetHandler | cloneFilledSheet | Clone sheet and values. |

Other touched areas:

- **Layout render:** `GET /api/backend/layouts/:layoutId/render?sheetId=...` — `layoutService` reads InformationValues by SheetID + InfoTemplateID (and RevisionID for ordering).
- **Revisions:** `sheetRevisionController` + `sheetRevisionQueries` + `revisionService` — snapshot/restore; revisionService duplicates InformationValues with RevisionID/InfoValue1/UOM1/InfoValue2/UOM2.
- **Stats:** `statsService` — aggregates InformationValues for completion.
- **informationQueries.getInformationBySubSheetId(subId, sheetId)** — used by legacy/datasheet flows; joins InformationValues on InfoTemplateID + SheetID.
- **datasheetQueries.getInformationBySubSheetId(subId)** — joins InformationValues on InfoTemplateID only (no SheetID in JOIN); likely bug for multi-sheet; listed for awareness.

### A.4 Exact files to modify (implementation phase)

**Backend — routes**

- `src/backend/routes/filledSheetRoutes.ts` — Add routes: GET/POST values by context/party, compare, PATCH variance, POST status transition; optionally mount under a feature-flag check.

**Backend — controllers**

- `src/backend/controllers/filledSheetController.ts` — Wire new handlers (get values by context/party, compare, update values for value set, variance PATCH, status transition). Keep existing get/update handlers; they will delegate to Requirement ValueSet when Phase 2 is active.
- New (optional): `src/backend/controllers/valueSetController.ts` — Dedicated controller for value-set and compare endpoints to keep filledSheetController from growing too much.

**Backend — services**

- `src/backend/services/filledSheetService.ts` — (1) Ensure Requirement ValueSet on create/get/update (ensureRequirementValueSet); (2) createOfferedValueSet with prefill; (3) getValueSet(sheetId, contextCode, partyId?); (4) getValuesForValueSet(valueSetId); (5) updateValuesForValueSet(valueSetId, updates) with Status = Draft check; (6) Wire getFilledSheetDetailsById to load from Requirement ValueSet when no context/party specified; (7) Wire updateFilledSheet to update Requirement ValueSet when no context/party specified.
- New: `src/backend/services/valueSetService.ts` (or keep in filledSheetService) — compare(sheetId, contexts, partyIds), updateVariance(valueSetId, infoTemplateId, status), transitionStatus(valueSetId, targetStatus).

**Backend — database / repositories**

- New: `src/backend/database/valueSetQueries.ts` (or valueContextQueries.ts) — CRUD for InformationValueSets, ValueContexts lookup, values by ValueSetID, prefill copy, variance upsert, status update.
- `src/backend/database/informationQueries.ts` — Extend or add overloads to support filtering by ValueSetID when present; keep existing getInformationBySubSheetId(sheetId, subId) for legacy.
- `src/backend/services/layoutService.ts` — When loading values for render, optionally scope by ValueSetID (or keep current behavior for “default” view = Requirement set).

**Frontend — pages**

- `src/app/(admin)/datasheets/filled/[id]/page.tsx` — Load sheet; add context/party to request when Phase 2 enabled.
- `src/app/(admin)/datasheets/filled/[id]/edit/page.tsx` — Same; pass context/party to editor.
- New: `src/app/(admin)/datasheets/filled/[id]/compare/page.tsx` — Read-only compare view (and optional client component).

**Frontend — components**

- `src/app/(admin)/datasheets/filled/[id]/FilledSheetPageClient.tsx` or equivalent — Add context selector (Requirement / Offered / As-Built) and party selector (when Offered).
- `src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx` — Accept context/party; submit updates to value-set endpoint; show Lock/Verify when applicable; add Accept/Reject for variance.
- New: Compare view component (e.g. `FilledSheetCompareView.tsx`) — Table: field | Requirement | Offered (per party) | As-Built; variance indicators; read-only.
- Optional: Shared context/party selector component for reuse.

**Feature flag**

- No existing feature flag found in repo. Option: add `NEXT_PUBLIC_PHASE2_VALUESETS=true` (or use existing env pattern) and gate new UI/routes in frontend; backend can always implement new endpoints and keep Phase 1 behavior when no context/party is sent.

---

## B) Migration plan (summary)

1. **ValueContexts** — Create table if not exists: ContextID (PK), Code, Name, SortOrder. Seed exactly three rows: (Requirement, Purchaser Requirement, 1), (Offered, Vendor Offered, 2), (AsBuilt, As-Built / Verified, 3). Use exact Codes and Names; re-run safe (insert only if row missing by Code).
2. **InformationValueSets** — Create table if not exists: ValueSetID (PK), SheetID, ContextID (FK ValueContexts.ContextID), PartyID (nullable), Status (varchar(30), default 'Draft'), CreatedAt, CreatedBy, UpdatedAt, UpdatedBy. FK to Sheets, ValueContexts; FK to Parties if table exists.
3. **InformationValues** — Add nullable column ValueSetID (FK InformationValueSets.ValueSetID). Add filtered unique index (ValueSetID, InfoTemplateID) WHERE ValueSetID IS NOT NULL. Add filtered unique index (SheetID, InfoTemplateID) WHERE ValueSetID IS NULL (if not already present).
4. **ValueSetFieldVariances** — Create table: ValueSetID, InfoTemplateID (PK), VarianceStatus (varchar(30) CHECK IN ('DeviatesAccepted','DeviatesRejected')), ReviewedBy (nullable), ReviewedAt (nullable). FK to InformationValueSets, InformationTemplates; optional FK ReviewedBy to Users.
5. **Backfill** — Optional separate script or final step: for each filled Sheet that has rows in InformationValues with ValueSetID NULL, create one InformationValueSet (Requirement, PartyID NULL), update those rows to set ValueSetID. (Can be run after deploy so existing code continues to work with NULL ValueSetID until backfill completes.)

---

## C) Implementation phases (after approval)

- **C) Backend** — Implement value set services/repos and new endpoints; keep Phase 1 APIs working by mapping to Requirement ValueSet.
- **D) Frontend** — Context/party selectors, compare view, Accept/Reject, Lock/Verify; behind flag if added.
- **E) Tests** — Backend integration tests for prefill, status rejection, variance, compare shape.

No code for C, D, E is produced until approval.

---

## D) Final decisions (locked) — quick reference

- **ValueContexts seed:** (Code, Name, SortOrder) = ('Requirement','Purchaser Requirement',1), ('Offered','Vendor Offered',2), ('AsBuilt','As-Built / Verified',3). Codes PascalCase.
- **InformationValueSets:** ValueSetID (PK), SheetID, ContextID (FK → ValueContexts.ContextID), PartyID (NULL), Status (Draft|Locked|Verified), CreatedAt, CreatedBy, UpdatedAt, UpdatedBy.
- **InformationValues:** Add nullable ValueSetID (FK → InformationValueSets). Unique (ValueSetID, InfoTemplateID) WHERE ValueSetID IS NOT NULL; unique (SheetID, InfoTemplateID) WHERE ValueSetID IS NULL.
- **Offered prefill:** Copy Requirement values into new Offered ValueSet: InfoTemplateID + value + UOM; null/empty as-is.
- **ValueSetFieldVariances:** PK(ValueSetID, InfoTemplateID); VarianceStatus 'DeviatesAccepted'|'DeviatesRejected'; ReviewedBy, ReviewedAt.
- **Status transitions:** Requirement/Offered Draft→Locked; AsBuilt Draft→Verified. Reject writes when Status != Draft.

---

## E) Migration scripts (location)

| Script | Purpose |
|--------|---------|
| `migrations/phase2_value_contexts_and_valuesets.sql` | Forward: create ValueContexts (+ seed), InformationValueSets, add ValueSetID + indexes, create ValueSetFieldVariances. |
| `migrations/phase2_backfill_requirement_valuesets.sql` | Optional, run after forward: backfill Requirement ValueSets for existing filled sheets and set ValueSetID on InformationValues. |
| `migrations/phase2_value_contexts_and_valuesets_rollback.sql` | Rollback: drop new table/column/indexes in reverse order. |
