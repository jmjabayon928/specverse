# Phase 2.5 — Step C: Implementation Plan

**Status:** Planning document. Bundle 1 and Bundle 2 migrations are implemented; backend/UI wiring (Bundle 3/4) is planned.  
**Contracts:** This plan implements the frozen contracts from:
- **Step A:** `docs/phase2.5-roles-permissions.md` (RBAC: roles, permissions, matrix, Superadmin).
- **Step B:** `docs/phase2.5-tenant-model-and-table-scope.md` (tenant model, table classification, schema scope; Manufacturers/Suppliers/Areas tenant-owned).

---

## 1) Scope & Goals

### Goals

- **Multi-account tenant model:** Introduce `Accounts` and `AccountMembers`; every tenant-owned table is scoped by `AccountID`. Users are global identities; membership and role are per (AccountID, UserID).
- **Account-scoped membership roles:** One role per (AccountID, UserID) via `AccountMembers.RoleID`; permissions are resolved from Role → RolePermissions → Permissions (global definitions, account-scoped assignment).
- **Tenant-scoped data filtering everywhere:** All reads/writes of tenant-owned data use `accountId` from the request context; no cross-account data exposure.
- **Platform Superadmin (system role) rules:** Superadmin is not in AccountMembers; determined outside app RBAC (e.g. env, IdP). When acting as Superadmin, backend may bypass AccountID for platform-only operations (tenant lifecycle, support, health). Normal data APIs remain account-scoped for all other users.

### Non-goals (restated)

- **No per-account custom roles.** Roles and the role × permission matrix are fixed per Step A; no custom role editor or per-account permission tweaks.
- **No big UI redesign.** Minimal UI change: default account only or a minimal account switcher (see §4). No full account-management UX in Phase 2.5.
- **No Phase 3–6 domain objects built yet.** Verification/Inspection, Ratings/Nameplate, Instrumentation/Loops, Schedules/Facilities are not implemented; permission keys for those phases remain placeholders.

---

## 2) Schema migration plan (exact ordered list)

**Platform:** SQL Server (database `DataSheets`). All migrations use T-SQL: **INT IDENTITY** for PKs, **DATETIME2** for timestamps, **GETDATE()** / **SYSUTCDATETIME()** for defaults. Bundle 1 is implemented as `phase2_5_bundle1_accounts_account_members.sql` (Accounts + AccountMembers + seed + backfill).

Migrations are to be created in a later step; this is the ordered plan. Each step: migration name (filename pattern), tables/constraints affected, backfill approach, risk level, rollback strategy.

| # | Migration name (suggested filename) | Tables/constraints affected | Backfill approach | Risk | Rollback |
|---|------------------------------------|-----------------------------|-------------------|------|----------|
| 1 | `phase2_5_create_accounts.sql` (or Bundle 1) | Create `dbo.Accounts` (AccountID INT IDENTITY, AccountName, Slug, IsActive, CreatedAt, UpdatedAt DATETIME2). PK, UQ(Slug), indexes. | N/A | Low | Drop table Accounts. |
| 2 | `phase2_5_create_account_members.sql` (or Bundle 1) | Create `dbo.AccountMembers` (AccountMemberID INT IDENTITY, AccountID, UserID, RoleID INT; IsActive, CreatedAt, UpdatedAt DATETIME2). PK, UQ(AccountID, UserID), FKs to Accounts, Users, Roles. | N/A | Low | Drop table AccountMembers. |
| 3 | `phase2_5_seed_default_account_and_members.sql` (or Bundle 1) | Insert one default Account; for each existing User, insert one AccountMembers row (AccountID = default, UserID, RoleID from Users.RoleID; if RoleID NULL, use Viewer role only—fail migration if Viewer missing). | Backfill from Users.RoleID; deterministic fallback to Viewer when RoleID is null; idempotent (no duplicate AccountID, UserID). | Medium | Delete default account rows and AccountMembers rows; optionally restore Users.RoleID from backup if removed later. |
| 4a | `phase2_5_add_accountid_reference_tables.sql` | Add `AccountID INT NOT NULL` (+ FK to Accounts) to: Clients, Projects, Warehouses, **Manufacturers, Suppliers, Areas**. Add index (AccountID) or (AccountID, …) for list queries. | SET AccountID = (default AccountID) for all existing rows. | Medium | Add column as NULL, backfill, then NOT NULL; rollback = drop column and FK (after reverting app). |
| 4b | `phase2_5_add_accountid_sheets.sql` | Add AccountID to Sheets; FK to Accounts; index (AccountID). | SET AccountID = default for all existing Sheets. | High | Same pattern (nullable → backfill → NOT NULL); rollback drop column/FK. |
| 4c | `phase2_5_add_accountid_sheet_children.sql` | Add AccountID to SubSheets, SheetNotes, Attachments, SheetAttachments, DatasheetLayouts, LayoutRegions, LayoutBlocks, LayoutSubsheetSlots, LayoutBodySlots, SheetHeaderKV, InfoTemplateGrouping, SheetRevisions. FK to Accounts where applied. | Set from parent Sheet (join on SheetID) or set to default. | High | Same; ensure dependency order (Sheets before children). |
| 4d | `phase2_5_add_accountid_information.sql` | Add AccountID to InformationTemplates, InformationTemplateOptions, InformationValues, InformationValueSets, ValueSetFieldVariances. | Set from Sheet (via SubSheets for templates) or default. | High | Same. |
| 4e | `phase2_5_add_accountid_inventory.sql` | Add AccountID to InventoryItems, Inventory, Warehouses (if not in 4a), InventoryTransactions, InventoryMaintenanceLogs, InventoryAuditLogs. | Set to default for all existing rows. | High | Same. |
| 4f | `phase2_5_add_accountid_estimation.sql` | Add AccountID to Estimations, EstimationPackages, EstimationItems, EstimationItemSupplierQuotes. | Set to default. | Medium | Same. |
| 4g | `phase2_5_add_accountid_audit_export_notifications.sql` | Add AccountID to AuditLogs, ChangeLogs, ExportJobs, Notifications, NotificationRecipients; Parties, MirrorTemplates if present. | Set to default. | Medium | Same. |
| 5 | `phase2_5_backfill_accountid_verify.sql` | No new columns; verify all tenant-owned rows have AccountID set; optionally CHECK constraints. | N/A (verification only). | Low | N/A. |
| 6 | `phase2_5_unique_constraints_account_scoped.sql` | Add/replace uniques: AccountMembers UQ(AccountID, UserID); Sheets (AccountID, …); Clients (AccountID, ClientCode); Projects (AccountID, ProjNum); Warehouses (AccountID, …); Manufacturers (AccountID, ManuName); Suppliers (AccountID, SuppCode) or (AccountID, SuppName); Areas (AccountID, AreaCode) or (AccountID, AreaName); ExportJobs if needed; etc. Drop old global uniques where they become (AccountID, X). | N/A | Medium | Drop new uniques; recreate old if needed (rare). |
| 7 | `phase2_5_foreign_keys_accountid.sql` | Add FKs to Accounts(AccountID) for all tenant-owned tables that received AccountID; ensure no orphan AccountIDs. | N/A | Low | Drop added FKs. |
| 8 | `phase2_5_indexes_accountid_queries.sql` | Add non-unique indexes for AccountID-filtered queries: e.g. (AccountID, CreatedAt), (AccountID, Status), (AccountID, SheetID), etc., per query patterns in §4 of Step B doc. | N/A | Low | Drop indexes. |

**Dependency order:** 1 → 2 → 3 → 4a → 4b → 4c → 4d → 4e → 4f → 4g → 5 → 6 → 7 → 8. Application code that threads `accountId` and filters by AccountID should be deployed after migrations and backfill are verified.

### Bundle 2 implementation status (implemented)

Bundle 2 (Add AccountID columns + backfill + constraints/indexes) is **implemented** with the following files.

**Forward migrations (run in order):**

1. `migrations/phase2_5_bundle2_add_accountid_columns.sql` — Add `AccountID INT NULL` to all tenant-owned tables.
2. `migrations/phase2_5_bundle2_backfill_accountid.sql` — Backfill `AccountID` with default account (Slug = 'default'); set `AccountID` to NOT NULL.
3. `migrations/phase2_5_bundle2_constraints_and_indexes.sql` — Add FK `AccountID` → `Accounts(AccountID)`, account-scoped uniques (e.g. Clients, Projects, Manufacturers, Suppliers, Areas, Warehouses), and AccountID-aware indexes.

**Rollback migrations (run in order to undo Bundle 2):**

1. `migrations/rollback_phase2_5_bundle2_constraints_and_indexes.sql` — Drop FKs, account-scoped uniques, and Bundle 2 indexes.
2. `migrations/rollback_phase2_5_bundle2_backfill_accountid.sql` — No-op (documented); no row-level revert.
3. `migrations/rollback_phase2_5_bundle2_drop_accountid_columns.sql` — Drop `AccountID` column from all tenant-owned tables.

**Verification:** `docs/phase2.5-bundle2-verification.md` — How to confirm default AccountID, NULL counts, spot checks, constraint/index checks, and rollback checklist.

---

## 3) Backend implementation plan

### 3.1 How accountId is derived for each request

- **Preferred:** After `verifyToken`, resolve current account from **membership lookup**: query `AccountMembers` for `(UserID = req.user.userId)` and derive `accountId` (e.g. single membership → use that AccountID; multiple → use default or header/query in future). Set **`req.user.accountId`** for the request. All tenant-scoped queries use this value only; **never** trust `accountId` from client body/query as authority.
- **Default account selection rules:** (1) If user has one AccountMembers row, use that AccountID. (2) If user has multiple, use a default (e.g. first by CreatedAt, or a “default account” preference column if added later). (3) For Phase 2.5 MVP, single-tenant: one account; no switcher required, so every user has exactly one membership and that is the default.
- **Storage of resolved accountId:** On the server, `req.user.accountId` is set by middleware (after token verification + membership lookup). Session/JWT sent to frontend may include `accountId` for display or minimal switcher; backend never uses client-supplied accountId for authorization.

### 3.2 Platform Superadmin bypass (backend-only, explicit)

- Superadmin is determined **server-side only** (e.g. env var `SUPERADMIN_USER_IDS`, or IdP claim, or bootstrap config). Not stored in Roles or AccountMembers.
- When the backend identifies the current user as Superadmin, it may **bypass** AccountID filtering only for **platform operations** (e.g. list accounts, create account, support endpoints). Normal data APIs (templates, filled sheets, inventory, estimation, audit, export) must still require an account context for Superadmin when performing data operations (e.g. “as which account?”); or Superadmin may be allowed to pass an optional accountId for impersonation under strict audit. Implementation must be explicit (e.g. `if (isSuperadmin(req.user)) { ... }`) and never default to “no filter” for data APIs.

### 3.3 Rule: accountId never accepted from client as authority

- **Authorization:** The authoritative `accountId` for the request is always derived from the authenticated user and AccountMembers (or Superadmin policy). Request body, query params, or headers must not be used to set the account context for authorization. Optional query/body `accountId` may be used only for display or for Superadmin “act as account” when explicitly designed and audited.

### 3.4 Backend hotspots to update (services/repositories/controllers)

- **Auth/session:** `authService.ts`, `authMiddleware.ts` — After login, resolve account (membership); include `accountId` in JWT/session. Middleware after verifyToken: resolve `req.user.accountId` from AccountMembers.
- **Permissions:** `permissionQueries.ts` — Resolve permissions in account context (User + AccountMembers for current account → RoleID → RolePermissions → Permissions).
- **Users (list/manage):** `usersService.ts`, `userQueries.ts` — Restrict to users in current account (AccountMembers where AccountID = req.user.accountId).
- **Roles:** `rolesService.ts` — List/assign in account context (AccountMembers.RoleID).
- **Templates/Sheets:** `templateService.ts`, `templateQueries.ts`, `datasheetTemplateQueries.ts`, `datasheetQueries.ts` — All Sheet/SubSheet/InformationTemplate/Values: add `accountId` to signatures; filter by AccountID (via Sheets or direct).
- **Filled sheets:** `filledSheetService.ts` — Same; scope by AccountID.
- **Layout:** `layoutService.ts` — DatasheetLayouts and related; scope by AccountID (e.g. via Sheet).
- **Value sets:** `valueSetQueries.ts`, `valueSetService.ts` — InformationValueSets/Values; scope by AccountID via Sheet.
- **Sheet revisions:** `sheetRevisionQueries.ts`, `revisionService.ts` — SheetRevisions; scope by AccountID via Sheet.
- **Export jobs:** `exportJobQueries.ts`, `exportJobService.ts` — Filter by AccountID; set AccountID on create.
- **Audit:** `auditQueries.ts`, `auditLogsService.ts` — Filter by AccountID; set AccountID on insert.
- **Change logs:** `changeLogQueries.ts` — Scope by AccountID (e.g. via Sheet).
- **Inventory:** `inventoryQueries.ts`, `inventoryTransactionQueries.ts`, `inventoryMaintenanceQueries.ts`, `inventoryAuditQueries.ts`, `inventoryController.ts` — All Inventory*, Warehouses: filter and insert with AccountID.
- **Estimation:** `estimationRepository.ts`, `estimationQueries.ts`, `estimationPackageQueries.ts`, `estimationItemQueries.ts`, `estimationQuoteQueries.ts`, `estimationService.ts` — Filter and insert with AccountID.
- **Reference options:** `ReferenceQueries.ts`, `templateQueries.ts` (fetchReferenceOptions) — Clients, Projects, Users, Warehouses, **Manufacturers, Suppliers, Areas**: filter by AccountID.
- **Clients/Projects:** `clientsService.ts`, `projectsService.ts`, `projectQueries.ts` — Filter by AccountID.
- **Manufacturers/Suppliers:** `manufacturersService.ts`, `suppliersService.ts` — Filter by AccountID for all operations.
- **Areas:** Any service/query that lists or writes Areas — filter by AccountID.
- **Notifications:** `notificationQueries.ts` — Filter by AccountID.
- **Mirror:** `mirrorRepo.ts` — If tenant-scoped, filter/insert by AccountID.
- **Sheet logs / Stats / Reports:** `sheetLogsService.ts`, `statsService.ts`, `reportsService.ts` — Ensure all underlying data access is account-scoped.
- **Duplicate sheet:** `duplicateSheet.ts` — New sheet must get current AccountID.

### 3.5 Standard signature for repository/service functions

- **Standard:** For any function that reads or writes tenant-owned data, the first parameter (or a dedicated options object) must include **`accountId: number`** (or `accountId: number | null` only for explicit Superadmin paths). Example: `getSheets(accountId: number, filters?: SheetFilters)` or `createTemplate(accountId: number, data: CreateTemplateInput)`. Callers (controllers/routes) pass `req.user.accountId`; never pass client-supplied accountId as the authority.

### 3.6 Must-have cross-account negative tests (checklist)

- Request with valid token for User A (member of Account 1) attempting to read a resource owned by Account 2 (e.g. Sheet, Client, Estimation, Inventory item, Export job, Audit log) returns **403 or 404** (no data leak).
- Request with valid token for User A but **inactive/removed membership** (no row in AccountMembers for current account) returns **403** (no access).
- List endpoints (templates, filled sheets, clients, projects, manufacturers, suppliers, areas, inventory, estimations, export jobs, audit logs) return only rows where `AccountID = req.user.accountId`.
- Creating a resource (template, filled sheet, client, project, manufacturer, supplier, area, inventory item, estimation, export job) sets `AccountID` from `req.user.accountId` only; supplying a different accountId in body does not change the stored AccountID.
- Export download and audit log read are scoped by account; User A cannot download export job or see audit log for Account 2.

---

## 4) Frontend implementation plan

### 4.1 How active account is chosen in Phase 2.5 MVP

- **Choice:** **Default account only (no switcher)** for Phase 2.5 MVP. Single-tenant installs have one account; every user has exactly one AccountMembers row. The backend sets `accountId` in the session/JWT after login; frontend uses that as the active account. No account switcher UI is required. If multiple accounts per user is supported later, a minimal switcher can be added (state that as a future option in the plan).

### 4.2 Where account context is stored

- **Session payload:** The session response from `GET /api/backend/auth/session` (and the JWT payload) must include **`accountId`** (number) so the frontend can display “current account” if needed and pass it only for display/context (e.g. future switcher). Backend never trusts frontend-supplied accountId for authorization.
- **Cookie claim:** JWT in cookie already carries payload; include `accountId` there so session refresh keeps context.
- **Server session response:** Session endpoint returns `{ userId, roleId, role, accountId, name, email, profilePic, permissions }` (or equivalent). Frontend stores this in state (e.g. `useSession`); no separate “account” cookie required beyond the session.

### 4.3 Pages to verify with tenant scoping

- **Templates:** List, detail, create, edit, clone, verify, approve; lifecycle (status transitions). All data must be for current account only.
- **Filled sheets:** List, detail, create, edit, verify, approve; lifecycle. Same.
- **Inventory:** List, detail, create, edit, delete; transactions list/create; maintenance logs. Dropdowns (manufacturers, suppliers, areas, warehouses) show only account’s data.
- **Export jobs (inventory CSV):** List and download only jobs for current account.
- **Audit logs:** List and filter only for current account.
- **Estimation:** List, detail, create, edit; packages, items, quotes. Clients/Projects dropdowns and data scoped to account.
- **Reference dropdowns:** Manufacturers, Suppliers, Areas (and Clients, Projects, Warehouses, Users) used in forms must be populated with account-scoped API calls; verify no cross-account options.

---

## 5) Permissions alignment plan (from Step A)

- **DATASHEET_CREATE:** Add backend enforcement on POST create (templates and filled sheets). Either require `DATASHEET_CREATE` or accept both `DATASHEET_CREATE` and `DATASHEET_EDIT` during transition; align with Step A contract (create routes require DATASHEET_CREATE or both).
- **DATASHEET_EXPORT:** Add `requirePermission('DATASHEET_EXPORT')` (or equivalent) to export endpoints (PDF/Excel for templates and filled sheets).
- **ESTIMATION_VIEW, ESTIMATION_CREATE, ESTIMATION_EDIT, ESTIMATION_EXPORT:** Add to backend estimation routes (list, get, create, update, export).
- **AUDIT_VIEW:** Replace or complement `requireAdmin` on audit log route with `requirePermission('AUDIT_VIEW')`; grant to Admin and Manager per matrix.
- **Remove/alias:** Remove `TEMPLATE_VERIFY` from frontend; use `DATASHEET_VERIFY` everywhere. Alias or remove `FILLED_CREATE` / `SHEET_CREATE` in favor of `DATASHEET_CREATE` for “create filled sheet” actions so one key is used consistently.
- **Rollout:** Prefer **support both keys briefly** (e.g. backend accepts DATASHEET_CREATE or DATASHEET_EDIT for create) then **hard cutover** to DATASHEET_CREATE only; frontend updated to use only canonical keys in one pass to avoid long-term divergence.

---

## 6) Test plan (mandatory)

### 6.1 API integration tests (Supertest or equivalent)

- **Cross-account read denied:** User in Account 1 cannot GET a Sheet/Client/Estimation/Inventory/ExportJob/AuditLog that belongs to Account 2 (403 or 404).
- **Cross-account write denied:** User in Account 1 cannot PUT/PATCH/DELETE a resource in Account 2; cannot POST create with a body that would assign Account 2 (must ignore and use req.user.accountId).
- **Membership inactive denied:** User with no AccountMembers row for the resolved account (or inactive membership) gets 403 on tenant-scoped endpoints.
- **Manufacturer/Supplier/Area dropdowns tenant-filtered:** Call to reference options or list manufacturers/suppliers/areas returns only rows for the request’s accountId (derive accountId from token + membership in test).
- **Audit and export endpoints account-scoped:** GET audit logs and GET export job list/download return only data for the request’s account.

### 6.2 Unit tests

- **accountId derivation helper:** Given a userId and optional “default account” rule, returns the correct accountId (e.g. from AccountMembers); edge cases: no membership, multiple memberships (default rule).
- **Permission mapping helpers (if any):** Any helper that maps role or permission keys for UI/API must return values consistent with Step A matrix (e.g. Reviewer never has DATASHEET_APPROVE).

### 6.3 UI tests (e.g. Playwright or similar)

- **Sidebar gating:** After membership roles (Admin, Reviewer, Engineer, etc.), sidebar items visible/hidden match role and permissions (e.g. Reviewer sees no Approve; Viewer sees only view links).
- **Tenant-scoped lists:** Templates list, filled sheets list, inventory list, estimation list show only data for the logged-in user’s account (single account in test); create a resource and confirm it appears; confirm no data from another account appears when two accounts exist.

---

## 7) Verification checklist

### 7.1 Manual smoke flows to rerun

- Login as Admin; open templates list → only account’s templates. Create template → succeeds and appears in list. Open template detail; edit; verify; approve (if applicable).
- Login as Engineer; create filled sheet from template; edit; verify. No approve button (or gated).
- Login as Viewer; templates list and filled list read-only; no create/edit/verify/approve actions.
- Inventory: list, create item, create transaction; manufacturers/suppliers/areas dropdowns show only account data.
- Export jobs: start inventory CSV export; list shows only own account’s jobs; download works for own job only.
- Audit logs: list shows only account’s audit entries; access denied for non–Admin/Manager if AUDIT_VIEW enforced.
- Estimation: list, create estimation, add package/items; clients/projects dropdowns account-scoped.
- Single-tenant: one account; no account switcher; all flows work with default account only.

### 7.2 Demo readiness steps

- Seed default account and AccountMembers for existing users (migration 3).
- Reset or reseed: ensure one Admin user in default account; optionally create sample template, filled sheet, inventory item, estimation.
- Document steps: login as Admin → create template → create filled → export; login as Viewer → view only; login as Engineer → create/verify, no approve.
- Verify no cross-account data in any list or dropdown.

---

## 8) Rollout strategy

- **Single-tenant compatibility:** One default account is created and all existing users get one AccountMembers row pointing to that account with their current role. No UX break: login flow unchanged; no account switcher; `req.user.accountId` is always set to the default account. Same codebase runs single-tenant (one account) and multi-tenant (multiple accounts) when multiple accounts are introduced later.
- **Data migration safety:** Add AccountID as NULL where needed; backfill with default AccountID; then alter to NOT NULL and add FKs. Run verification migration (step 5) before cutting over app. No drop of existing data.
- **Feature flags:** Use only if necessary (e.g. “enable account filtering” behind a flag for quick rollback). Prefer deploying with account filtering always on after migrations and backfill are verified; feature flags add complexity and should be avoided unless operational risk requires them.

---

**End of implementation plan. No code or migrations are created in this step.**
