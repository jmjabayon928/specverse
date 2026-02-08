# Phase 4 – Ratings & Nameplate Modeling: Step A Discovery Report

**Constraints:** No migrations. DB tables already exist. No file edits. Read-only discovery.

---

## 1. Best Similar-Module Pattern: Verification Records

| Aspect | Verification Records (copy this) |
|--------|----------------------------------|
| **Route mount – nested (by sheet)** | `app.use('/api/backend/datasheets', datasheetVerificationRecordsRoutes)` |
| **Route mount – standalone** | `app.use('/api/backend/verification-records', verificationRecordsRoutes)` |
| **Nested route file** | `src/backend/routes/datasheetVerificationRecordsRoutes.ts` |
| **Standalone route file** | `src/backend/routes/verificationRecordsRoutes.ts` |
| **Controller** | `src/backend/controllers/verificationRecordsController.ts` |
| **Service** | `src/backend/services/verificationRecordsService.ts` |
| **Repository** | `src/backend/repositories/verificationRecordsRepository.ts` |
| **Nested path** | `/:sheetId/verification-records` → `GET /api/backend/datasheets/:sheetId/verification-records` |
| **Standalone paths** | `GET/POST /api/backend/verification-records`, `GET/POST /api/backend/verification-records/:id`, etc. |

**Note:** Verification Records use a link table (VerificationRecordLinks) between records and sheets. RatingsBlocks has a direct `SheetID` FK, so no link table—simpler.

---

## 2. Sheet Account Scoping (where enforced)

| Layer | Where | How |
|-------|-------|-----|
| **Service** | `sheetAccessService.ts` | `sheetBelongsToAccount(sheetId, accountId)` — queries `Sheets WHERE SheetID = ? AND AccountID = ?` |
| **Service** | `verificationRecordsService.ts` | Calls `sheetBelongsToAccount` before any sheet-scoped or link operation (listForSheet, linkToSheet, unlinkFromSheet) |
| **Repository** | `verificationRecordsRepository.ts` | `listVerificationRecordsForSheet` joins `VerificationRecordLinks` + `VerificationRecords` and filters by `AccountID` (VerificationRecords has AccountID) |
| **Controller** | All handlers | Use `mustGetAccountId(req, next)` from `authGuards.ts`; pass `accountId` to service |
| **Middleware** | None for sheet scoping | Auth is `verifyToken` + `requirePermission`; account context comes from JWT/session via `attachAccountContext` |

**RatingsBlocks:** Has `SheetID` but no `AccountID`. Scoping must be via `Sheets`: join `RatingsBlocks` → `Sheets` and filter by `Sheets.AccountID = @AccountID`. Service must call `sheetBelongsToAccount(sheetId, accountId)` for any operation that takes a sheet; for `getById(blockId)`, resolve block → sheetId → then verify `sheetBelongsToAccount(sheetId, accountId)`.

---

## 3. Minimal Backend API Contract for Ratings

**Existing tables (no schema changes):**
- `dbo.RatingsBlocks`: RatingsBlockID, SheetID, BlockType, SourceValueSetID, LockedAt, LockedBy, Notes, CreatedAt, UpdatedAt
- `dbo.RatingsEntries`: EntryID, RatingsBlockID, Key, Value, UOM, OrderIndex

### Proposed Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/backend/datasheets/:sheetId/ratings` | List blocks for sheet |
| GET | `/api/backend/ratings/:id` | Get block + entries (inline) |
| POST | `/api/backend/ratings` | Create block (body: sheetId, blockType?, sourceValueSetID?, notes?, entries[]) |
| PATCH | `/api/backend/ratings/:id` | Update block + replace entries. **Reject if LockedAt is set** (409) |
| DELETE | `/api/backend/ratings/:id` | Delete block (and cascade entries). Reject if LockedAt set |

### Entries handling

**Recommendation: replace entries in one call.**

- **Create:** `POST /api/backend/ratings` body includes `entries: [{ key, value, uom?, orderIndex? }]` — insert block, then insert entries.
- **Update:** `PATCH /api/backend/ratings/:id` body includes `entries: [{ key, value, uom?, orderIndex? }]` — delete existing entries for block, insert new set. Simpler than add/update/remove; avoids orphan/orphan-order bugs.

Alternative (not recommended): separate `POST/PATCH/DELETE /api/backend/ratings/:id/entries` for granular CRUD. More endpoints, more complexity.

### Lock behavior

- `PATCH` and `DELETE` must check `LockedAt IS NOT NULL` before mutating; return 409 with message like "Ratings block is locked."
- `GET` always allowed (read-only when locked).

---

## 4. Permissions

**Recommendation: reuse existing `DATASHEET_VIEW` / `DATASHEET_EDIT`.**

- Ratings/nameplate are datasheet-linked; same UX surface as verification records.
- Verification records already use `DATASHEET_VIEW` and `DATASHEET_EDIT` (see `verificationRecordsRoutes.ts`, `datasheetVerificationRecordsRoutes.ts`).
- Avoids adding new permission keys and DB seeds; keeps Step B smaller.

| Endpoint | Permission |
|----------|------------|
| GET `/api/backend/datasheets/:sheetId/ratings` | DATASHEET_VIEW |
| GET `/api/backend/ratings/:id` | DATASHEET_VIEW |
| POST `/api/backend/ratings` | DATASHEET_EDIT |
| PATCH `/api/backend/ratings/:id` | DATASHEET_EDIT |
| DELETE `/api/backend/ratings/:id` | DATASHEET_EDIT |

**If separate permissions are required later:** Add `RATINGS_VIEW`, `RATINGS_EDIT` to `permissions.ts` and dbo.Permissions; swap in routes. Not needed for minimal Step B.

---

## 5. Step B Allowlist (exact files to create/modify)

### 5.1 Files to CREATE

| File | Purpose |
|------|---------|
| `src/backend/routes/datasheetRatingsRoutes.ts` | Nested: `/:sheetId/ratings` GET |
| `src/backend/routes/ratingsRoutes.ts` | Standalone: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id |
| `src/backend/controllers/ratingsController.ts` | Handlers: listForSheet, getById, create, update, delete |
| `src/backend/services/ratingsService.ts` | Business logic, sheetBelongsToAccount, LockedAt checks |
| `src/backend/repositories/ratingsRepository.ts` | SQL: listForSheet, getByIdWithEntries, create, update, delete, replaceEntries |
| `src/domain/ratings/ratingsTypes.ts` | Types: RatingsBlock, RatingsEntry, DTOs |
| `src/components/datasheets/RatingsBlocksList.tsx` | UI: list blocks, create, view/edit entries, lock-aware |
| `tests/api/ratings.accountScope.test.ts` | API account scoping + lock rejection |
| `tests/services/ratingsService.test.ts` | Service unit tests |
| `tests/repositories/ratingsRepository.test.ts` | Repository unit tests (or integration if DB available) |
| `tests/ui/datasheets/RatingsBlocksList.test.tsx` | Component tests |

### 5.2 Files to MODIFY

| File | Change |
|------|--------|
| `src/backend/app.ts` | Import `datasheetRatingsRoutes`, `ratingsRoutes`; add `app.use('/api/backend/datasheets', datasheetRatingsRoutes)`; add `app.use('/api/backend/ratings', ratingsRoutes)` |
| `src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx` | Add `<RatingsBlocksList sheetId={sheetId} />` (after Verification Records fieldset) |
| `src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx` | Same: add `<RatingsBlocksList sheetId={sheetId} />` |

**Note on app.ts:** Mount `datasheetRatingsRoutes` at `/api/backend/datasheets` alongside `datasheetVerificationRecordsRoutes`. Express tries each router in order; `/:sheetId/verification-records` and `/:sheetId/ratings` are distinct and will match correctly.

---

## 6. Targeted Test Commands (Step B only)

Run only the new/changed test files:

```bash
# API account scoping
npx jest tests/api/ratings.accountScope.test.ts

# Service
npx jest tests/services/ratingsService.test.ts

# Repository
npx jest tests/repositories/ratingsRepository.test.ts

# UI component
npx jest tests/ui/datasheets/RatingsBlocksList.test.tsx
```

Or all ratings-related tests:

```bash
npx jest --testPathPattern="ratings"
```

---

## 7. Summary

| Item | Value |
|------|-------|
| Pattern to copy | Verification Records |
| Nested mount | `/api/backend/datasheets` + `/:sheetId/ratings` |
| Standalone mount | `/api/backend/ratings` |
| Account scoping | Service: `sheetBelongsToAccount`; Repo: join RatingsBlocks → Sheets, filter by AccountID |
| Entries | Replace in one call (create + update) |
| Lock | Reject PATCH/DELETE when LockedAt set |
| Permissions | DATASHEET_VIEW, DATASHEET_EDIT (reuse) |
| Files to create | 11 |
| Files to modify | 3 |

---

**STOP.** No code changes. Plan ready for Step B execution.
