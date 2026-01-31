# Phase 2: Operations and Runbook

**Purpose:** How to run Phase 2 migrations, create Offered/As-Built value sets, and known limitations. No code; operational reference only.

---

## 1) Running migrations

### 1.1 Order

Run in this order against the target database (e.g. SQL Server):

1. **Forward migration**  
   `migrations/phase2_value_contexts_and_valuesets.sql`  
   - Creates ValueContexts, InformationValueSets, InformationValues.ValueSetID + indexes, UOM column + backfill, ValueSetFieldVariances.  
   - Idempotent; safe to re-run.

2. **Backfill (optional, when ready)**  
   `migrations/phase2_backfill_requirement_valuesets.sql`  
   - Creates one Requirement ValueSet per filled sheet that has legacy rows (ValueSetID IS NULL).  
   - Sets ValueSetID on those rows.  
   - Skips template sheets (IsTemplate = 1).  
   - Safe to re-run.

3. **Parties FK (only when dbo.Parties exists)**  
   `migrations/phase2_add_parties_fk.sql`  
   - Orphan check, then adds FK InformationValueSets.PartyID → Parties(PartyID).  
   - Run only after Parties table is created and populated.

### 1.2 Rollback

To undo the forward migration (use with care; may lose Phase 2 data):

- Run `migrations/phase2_value_contexts_and_valuesets_rollback.sql`.  
- Drops ValueSetFieldVariances, InformationValueSets, ValueContexts; drops ValueSetID column and related indexes/FKs from InformationValues.  
- The **UOM** column on InformationValues is **not** dropped (see script comment).

---

## 2) Creating Offered and As-Built value sets

### 2.1 Offered (vendor response)

- **API:** `POST /api/backend/sheets/:sheetId/valuesets`  
  Body: `{ "context": "Offered", "partyId": <positive integer> }`
- **Behavior:** Creates one Offered ValueSet for (SheetID, Offered, PartyID). Prefills by copying effective Requirement values (idempotent at row level).  
- **UI:** Filled sheet page → Context selector → Offered tab → enter Party ID (vendor) → “Add vendor response”. Then use “View compare” to see offered values.

### 2.2 As-Built (copy from Requirement)

- **API:** `POST /api/backend/sheets/:sheetId/valuesets`  
  Body: `{ "context": "AsBuilt" }`
- **Behavior:** Creates one AsBuilt ValueSet for the sheet (PartyID NULL). Prefills by copying effective Requirement values (idempotent).  
- **UI:** Filled sheet page → Context selector → As-Built tab → “Copy Requirement → As-Built”. Then “View compare” to see as-built values.

### 2.3 Compare view

- **Route:** `/datasheets/filled/[id]/compare`  
- **API:** `GET /api/backend/sheets/:sheetId/compare?offeredPartyId=` (optional filter).  
- Shows Field | Requirement | Offered (per vendor or all) | As-Built, with variance badges (Accepted/Rejected) and Accept/Reject/Clear when ValueSet status is Draft.

---

## 3) Known limitations

- **Party ID input:** No Parties UI or dropdown yet. Vendor is identified by a **positive integer Party ID** (free text input with validation). Replace with a Parties dropdown when a Parties endpoint/data is available.
- **No reverse status transitions:** Requirement/Offered can only go Draft → Locked; AsBuilt can only go Draft → Verified. No unlock/unverify in Phase 2.
- **No automated compliance:** “Meets requirement” is not derived or stored; variance status is Accepted/Rejected or absent (not reviewed).
- **Compare fetch:** Server-side fetch on the compare page uses default Next.js caching; no extra cache tuning in Phase 2. Backend compare may do multiple queries per offered set; batch optimization left for later if needed.
- **E2E:** No Playwright (or other) e2e in repo yet. RTL tests cover compare table rendering and variance PATCH payload; add Playwright smoke when desired.

---

## 4) Verification

- After forward migration: `SELECT * FROM dbo.ValueContexts` → 3 rows (Requirement, Offered, AsBuilt).
- After backfill: Filled sheets with legacy InformationValues rows should have those rows updated with a non-NULL ValueSetID and a corresponding Requirement InformationValueSet per sheet.
- Create Offered (POST with context=Offered, partyId) then GET compare → offered column populated for that party.
- Create As-Built (POST with context=AsBuilt) then GET compare → asBuilt section populated.
