# Phase 2.5 — Step B: Tenant Model & Table Scoping (Planning Only)

**Status:** Planning document — no code or schema changes.  
**Prerequisite:** Phase 2.5 Step A (roles/permissions) is finalized and frozen per `docs/phase2.5-roles-permissions.md`.  
**Source of truth:** Existing database schema (tables, indexes, constraints, triggers) as inferred from migrations and backend query usage.

---

## 1) Account model

### 1.1 Accounts table (minimal)

| Column       | Type         | Notes |
|-------------|--------------|--------|
| AccountID   | INT IDENTITY | PK. |
| AccountName | NVARCHAR(255)| Display name. |
| Slug        | NVARCHAR(64) | Optional; for URL/subdomain if needed. |
| IsActive    | BIT          | Default 1. |
| CreatedAt   | DATETIME2    | Default GETDATE(). |
| UpdatedAt   | DATETIME2    | Nullable. |

No schema change is made in this step; the above is the target minimal shape for the **Accounts** table when implemented.

### 1.2 AccountMembers (or equivalent) and relationship to Users

- **AccountMembers** (or equivalent) links **Users** to **Accounts** with a **per-account role**.
- Recommended minimal columns: `AccountID`, `UserID`, `RoleID`, `CreatedAt`. Optional: `InvitedBy`, `InvitedAt`.
- **Relationship:** Many-to-many between Users and Accounts: one user can belong to multiple accounts, with one role per account (one row per (AccountID, UserID)).
- **Users** remain the global identity (one row per human). They do **not** hold AccountID; membership is only in AccountMembers. This supports the same person in multiple tenants with different roles.

### 1.3 Users as global identities with per-account membership

- **Users** table stays **global** (no AccountID column).
- A user is identified by email (or external Id) globally; which account(s) they can access and with which role is determined by **AccountMembers**.
- Login and session must become account-aware: either the user selects an account after login, or the context is derived from URL/header/subdomain. The session (and JWT) will carry at least one `accountId` (current context) so that all data access is scoped to that account.

### 1.4 Platform Superadmin (outside AccountMembers)

- **Platform Superadmin** is not a row in AccountMembers and is not scoped by AccountID (per Phase 2.5 Step A).
- Superadmin is determined outside the application’s account RBAC (e.g. environment variable, external IdP claim, or platform bootstrap). When acting as Superadmin, the backend may bypass AccountID filtering for platform operations only (tenant provisioning, support, platform health). Normal API and data access for all other users remain account-scoped via `req.user.accountId` and AccountMembers.

---

## 2) Table classification

Every table referenced in migrations and backend code is classified as **Global**, **Tenant-owned**, or **Hybrid**, with a one-line justification.

### 2.1 Global (no AccountID)

| Table | Justification |
|-------|----------------|
| **Users** | Global identity; membership and scope are via AccountMembers. |
| **Roles** | Canonical role definitions; same role set across accounts (Phase 2.5 Step A: no per-account custom roles). |
| **Permissions** | Canonical permission keys; shared across accounts. |
| **RolePermissions** | Global role–permission matrix; account-scoped assignment is via AccountMembers.RoleID. |
| **ValueContexts** | Lookup (Requirement, Offered, AsBuilt); shared reference data. |
| **Disciplines** | Lookup; shared reference. |
| **DatasheetSubtypes** | Lookup; shared reference. |
| **NoteTypes** | Lookup; shared reference. |
| **Categories** | Reference; currently global; may stay global or become tenant-overridable later (out of scope here). |
| **InfoTemplateTranslations** | i18n; global label translations by LangCode. |
| **SheetTranslations** | i18n; global. |
| **SubsheetTranslations** | i18n; global. |

### 2.2 Tenant-owned (requires AccountID)

| Table | Justification |
|-------|----------------|
| **Accounts** | Tenant root; no AccountID on self. |
| **AccountMembers** | Links Users to Accounts with RoleID; tenant membership. |
| **Sheets** | Templates and filled sheets; core tenant data. |
| **SubSheets** | Belongs to Sheets; tenant-owned. |
| **InformationTemplates** | Belongs to SubSheets; tenant-owned. |
| **InformationTemplateOptions** | Belongs to InformationTemplates; tenant-owned. |
| **InformationValues** | Belongs to Sheets/ValueSets; tenant-owned. |
| **InformationValueSets** | Belongs to Sheets; tenant-owned. |
| **ValueSetFieldVariances** | Belongs to InformationValueSets; tenant-owned. |
| **SheetNotes** | Belongs to Sheets; tenant-owned. |
| **Attachments** | Stored files; tenant-owned (or scoped via SheetAttachments). |
| **SheetAttachments** | Links Attachments to Sheets; tenant-owned. |
| **DatasheetLayouts** | Tied to template (Sheet); tenant-owned. |
| **LayoutRegions** | Belongs to DatasheetLayouts; tenant-owned. |
| **LayoutBlocks** | Belongs to LayoutRegions; tenant-owned. |
| **LayoutSubsheetSlots** | Layout structure; tenant-owned. |
| **LayoutBodySlots** | Layout structure; tenant-owned. |
| **SheetHeaderKV** | Belongs to Sheets; tenant-owned. |
| **InfoTemplateGrouping** | Belongs to template structure; tenant-owned. |
| **SheetRevisions** | Belongs to Sheets; tenant-owned. |
| **ExportJobs** | Per-user export jobs; must be scoped by account. |
| **AuditLogs** | Audit trail; must be account-scoped for isolation. |
| **ChangeLogs** | Sheet change history; tenant-owned. |
| **InventoryItems** | Item master; tenant-owned so each account has its own catalog. |
| **Inventory** | Quantity per item/warehouse; tenant-owned. |
| **Warehouses** | Tenant-owned locations. |
| **InventoryTransactions** | Tenant-owned transactions. |
| **InventoryMaintenanceLogs** | Tenant-owned. |
| **InventoryAuditLogs** | Tenant-owned. |
| **Estimations** | Tenant-owned. |
| **EstimationPackages** | Belongs to Estimations; tenant-owned. |
| **EstimationItems** | Belongs to Estimations/Packages; tenant-owned. |
| **EstimationItemSupplierQuotes** | Belongs to estimation items; tenant-owned. |
| **Clients** | Tenant-owned (account’s clients). |
| **Projects** | Tenant-owned (account’s projects). |
| **Notifications** | Tenant-owned (account-scoped notifications). |
| **NotificationRecipients** | Belongs to Notifications; tenant-owned. |
| **Parties** | Referenced by InformationValueSets; tenant-owned (account’s parties). |
| **MirrorTemplates** | ClientKey/source kind; tenant-owned if used per account. |
| **Manufacturers** | Business/vendor catalog; differs per organization and can collide by name across accounts; tenant-owned to avoid namespace collisions. |
| **Suppliers** | Business/vendor catalog; differs per organization and can collide by name/code across accounts; tenant-owned to avoid namespace collisions. |
| **Areas** | Org/site/facility-specific; must not be shared across accounts; tenant-owned for realistic enterprise workflows and Phase 6 (facilities/schedules). |

### 2.3 Hybrid (global definition + tenant usage)

| Table | Justification |
|-------|----------------|
| (None in current schema) | All tables are classified as either global (reference/identity) or tenant-owned. No table is both “global definition” and “tenant usage” in the sense of a single table holding shared definitions with tenant-specific rows; reference data is global, tenant data is tenant-owned. |

*Note: Categories remains Global in this plan; a product decision may later make it tenant-overridable (e.g. tenant-specific categories), which would be a separate schema change.*

**Decision note:** Manufacturers, Suppliers, and Areas were initially considered global reference data. They are intentionally classified as tenant-owned to avoid namespace collisions (e.g. same manufacturer or area name meaning different entities in different organizations), to support realistic enterprise workflows where each account maintains its own vendor and site catalogs, and to align with future phases—especially Phase 6 (facilities/schedules), where areas and site-specific data are account-scoped.

---

## 3) Required schema changes (planning only)

### 3.1 Tables that need AccountID added

- **AccountMembers** — not “added”; table is new and includes AccountID as FK.
- **Sheets**, **SubSheets**, **InformationTemplates**, **InformationTemplateOptions**, **InformationValues**, **InformationValueSets**, **ValueSetFieldVariances**, **SheetNotes**, **Attachments**, **SheetAttachments**, **DatasheetLayouts**, **LayoutRegions**, **LayoutBlocks**, **LayoutSubsheetSlots**, **LayoutBodySlots**, **SheetHeaderKV**, **InfoTemplateGrouping**, **SheetRevisions**, **ExportJobs**, **AuditLogs**, **ChangeLogs**, **InventoryItems**, **Inventory**, **Warehouses**, **InventoryTransactions**, **InventoryMaintenanceLogs**, **InventoryAuditLogs**, **Estimations**, **EstimationPackages**, **EstimationItems**, **EstimationItemSupplierQuotes**, **Clients**, **Projects**, **Notifications**, **NotificationRecipients**, **Parties** (if it exists), **MirrorTemplates**, **Manufacturers**, **Suppliers**, **Areas**.

For **Inventory**: confirm whether the PK is (InventoryID, WarehouseID) or a single ID; AccountID must be added and all FKs/joints must remain consistent. For **InventoryItems**: code uses `InventoryID` as identity in some places; ensure Item master is clearly tenant-scoped and Inventory/transactions follow.

### 3.2 Unique constraints that must become (AccountID, X)

- **Sheets:** Any unique on (SheetName, …) or similar → (AccountID, SheetName, …) so names are unique per account.
- **SubSheets:** Uniqueness by (SheetID, …) is already scoped by Sheet; when Sheets get AccountID, no extra change if SheetID is the only scope.
- **InformationValueSets:** Filtered uniques (SheetID, ContextID, PartyID) and (SheetID, ContextID) → remain sheet-scoped; Sheets will have AccountID.
- **InformationValues:** Unique (ValueSetID, InfoTemplateID) and legacy (SheetID, InfoTemplateID) → ValueSet/Sheet are tenant-scoped once parent tables have AccountID.
- **ExportJobs:** If any unique is by (CreatedBy, …) → (AccountID, CreatedBy, …) or equivalent so listing/filtering is per account.
- **Clients:** ClientCode or similar → (AccountID, ClientCode) if unique per account.
- **Projects:** ProjNum or similar → (AccountID, ProjNum) if unique per account.
- **Categories:** If kept global, no change. If later made per-account, (AccountID, CategoryName or Code).
- **Warehouses:** WarehouseName or code → (AccountID, …) per account.
- **AccountMembers:** Unique (AccountID, UserID) so a user has at most one role per account.
- **Manufacturers:** Uniqueness becomes account-scoped: **UNIQUE (AccountID, ManuName)** (or the actual name column in schema).
- **Suppliers:** Uniqueness becomes account-scoped: **UNIQUE (AccountID, SuppCode)** or **UNIQUE (AccountID, SuppName)** per actual schema columns.
- **Areas:** Uniqueness becomes account-scoped: **UNIQUE (AccountID, AreaCode)** or **UNIQUE (AccountID, AreaName)** per actual schema columns.

All other uniqueness that is today scoped by a parent (e.g. SubSheets by SheetID) inherits tenant scope once the parent has AccountID.

### 3.3 Foreign keys that must include AccountID

- **AccountMembers:** FK to Accounts(AccountID), Users(UserID), Roles(RoleID).
- **Sheets:** FK to Accounts(AccountID); existing FKs (ClientID, ProjectID, CategoryID, etc.) remain; if Clients/Projects get AccountID, ensure Sheets.AccountID matches or is redundant with Client/Project account (design choice: same account or cross-account reference).
- All child tables of Sheets (SubSheets, SheetNotes, SheetAttachments, SheetRevisions, etc.): AccountID can be added for direct filtering and consistency; FK to Accounts(AccountID). Alternatively, scope only at Sheets and enforce via application joins (trade-off: simpler schema vs. denormalized AccountID for performance).
- **ExportJobs:** FK to Accounts(AccountID), Users(UserID).
- **AuditLogs:** AccountID column; optional FK to Accounts(AccountID). PerformedBy remains UserID.
- **InventoryItems, Inventory, Warehouses, InventoryTransactions, InventoryMaintenanceLogs, InventoryAuditLogs:** FK to Accounts(AccountID) where applicable.
- **Estimations, EstimationPackages, EstimationItems, EstimationItemSupplierQuotes:** FK to Accounts(AccountID); Estimations already reference Clients and Projects (tenant-owned), so AccountID must align.
- **Clients, Projects:** FK to Accounts(AccountID).
- **Notifications, NotificationRecipients:** FK to Accounts(AccountID) so notifications are account-scoped.
- **Parties:** If present, FK to Accounts(AccountID).
- **MirrorTemplates:** If tenant-scoped, add AccountID and FK to Accounts(AccountID).
- **Manufacturers, Suppliers, Areas:** FK to Accounts(AccountID).

Any FK from a tenant-owned table to another tenant-owned table (e.g. Sheets → Clients) should enforce same-account where applicable (e.g. check Sheets.AccountID = Clients.AccountID or rely on application logic until DB checks are added).

### 3.4 Tables that explicitly must NOT get AccountID

- **Users** — global identity.
- **Roles** — global definitions.
- **Permissions** — global definitions.
- **RolePermissions** — global role–permission matrix.
- **ValueContexts**, **Disciplines**, **DatasheetSubtypes**, **NoteTypes** — global lookups.
- **Categories** — treated as global in this plan (no AccountID unless a later product decision changes that).
- **InfoTemplateTranslations**, **SheetTranslations**, **SubsheetTranslations** — global i18n.

---

## 4) Query & service impact

### 4.1 Backend services and repositories that must apply AccountID filtering

| Layer | File(s) | Change |
|-------|--------|--------|
| Auth | `authService.ts`, `authMiddleware.ts` | Resolve current account (e.g. from JWT/session); set `req.user.accountId`; login/context may require account selection or default. |
| Permissions | `permissionQueries.ts` | Resolve permissions in account context (User + AccountMembers.RoleID + RolePermissions). |
| Users (list/manage) | `usersService.ts`, `userQueries.ts` | Restrict to users in current account (via AccountMembers where AccountID = req.user.accountId). |
| Roles | `rolesService.ts` | List/assign roles in account context; RoleID in AccountMembers is account-scoped assignment. |
| Templates / Sheets | `templateService.ts`, `templateQueries.ts`, `datasheetTemplateQueries.ts`, `datasheetQueries.ts` | All Sheet/SubSheet/InformationTemplate/Values queries must filter by AccountID (via Sheets or direct). |
| Filled sheets | `filledSheetService.ts` | Same as templates; scope by AccountID. |
| Layout | `layoutService.ts` | DatasheetLayouts and related tables; scope by AccountID (e.g. via Sheet). |
| Value sets | `valueSetQueries.ts`, `valueSetService.ts` | InformationValueSets/Values; scope by AccountID via Sheet. |
| Sheet revisions | `sheetRevisionQueries.ts`, `revisionService.ts` | SheetRevisions; scope by AccountID via Sheet. |
| Export jobs | `exportJobQueries.ts`, `exportJobService.ts` | Filter by AccountID; add AccountID on create. |
| Audit | `auditQueries.ts`, `auditLogsService.ts` | Filter AuditLogs by AccountID; add AccountID on insert. |
| Change logs | `changeLogQueries.ts` | ChangeLogs; scope by AccountID (e.g. via Sheet). |
| Inventory | `inventoryQueries.ts`, `inventoryTransactionQueries.ts`, `inventoryMaintenanceQueries.ts`, `inventoryAuditQueries.ts`, `inventoryController.ts` | All Inventory*, Warehouses; filter and insert with AccountID. |
| Estimation | `estimationRepository.ts`, `estimationQueries.ts`, `estimationPackageQueries.ts`, `estimationItemQueries.ts`, `estimationQuoteQueries.ts`, `estimationService.ts` | Estimations and related tables; filter and insert with AccountID. |
| Reference options | `ReferenceQueries.ts`, `templateQueries.ts` (fetchReferenceOptions) | Clients, Projects, Users (for dropdowns), Warehouses, **Manufacturers, Suppliers, Areas** must be account-scoped; filter all reference dropdowns for Manufacturers, Suppliers, and Areas by AccountID. |
| Clients / Projects | `clientsService.ts`, `projectsService.ts`, `projectQueries.ts` | Filter by AccountID. |
| Categories | `categoriesService.ts` | If Categories stay global, no filter; if per-account, filter by AccountID. |
| Manufacturers / Suppliers | `manufacturersService.ts`, `suppliersService.ts` | Filter by AccountID; all list/get/create/update/delete must scope by current account. |
| Notifications | `notificationQueries.ts` | Filter Notifications/Recipients by AccountID. |
| Mirror | `mirrorRepo.ts` | If MirrorTemplates are tenant-scoped, filter/insert by AccountID. |
| Sheet logs | `sheetLogsService.ts` | Uses audit/change logs and sheet data; ensure AccountID scope. |
| Stats / Reports | `statsService.ts`, `reportsService.ts` | All underlying data (Sheets, Inventory, Estimations, etc.) must be account-scoped. |
| Duplicate sheet | `duplicateSheet.ts` | New sheet must get current AccountID. |

- **Reference dropdowns for Manufacturers, Suppliers, and Areas:** All endpoints and forms that populate dropdowns (e.g. `fetchReferenceOptions()`, list Manufacturers/Suppliers/Areas) must filter by `AccountID` so users only see their account’s catalog.

### 4.2 High-risk areas

- **Sheets and all dependent data:** Largest surface (templates, filled sheets, layout, value sets, revisions, notes, attachments). Every path that reads/writes Sheets or children must enforce AccountID; missing filter = cross-tenant data leak.
- **Inventory (InventoryItems, Inventory, Warehouses, Transactions, Maintenance, AuditLogs):** Many queries and inserts; must add AccountID to all and filter every list/detail/create/update.
- **Estimation (Estimations, Packages, Items, Quotes):** Complex joins (Clients, Projects, Users, Inventory, Sheets); all must be account-scoped and FKs consistent.
- **AuditLogs:** Must store AccountID on insert and filter on read so tenants only see their own audit trail.
- **ExportJobs:** Must scope by AccountID so users only see and download jobs for their current account; file paths or cleanup logic may need account awareness.
- **ReferenceQueries / dropdowns:** When Clients, Projects, Users (for assignees), Warehouses, **Manufacturers, Suppliers, and Areas** are tenant-scoped, all forms that use `fetchReferenceOptions()` or similar must receive account context and queries must filter by AccountID. Reference dropdowns for Manufacturers, Suppliers, and Areas must always filter by AccountID.

### 4.3 How req.user.accountId will be threaded

- **JWT / session:** After login (and optional account selection), include `accountId` in the token/session. Middleware (`verifyToken` or equivalent) sets `req.user.accountId` from the token.
- **All tenant-scoped operations:** Services and repositories receive `accountId` from the route (e.g. `req.user.accountId`). They pass it into every query that reads or writes tenant-owned tables (WHERE AccountID = @AccountID or INSERT … AccountID = @AccountID).
- **Superadmin:** When `req.user` indicates Superadmin, backend may allow `accountId` to be null or a special “all accounts” mode for platform operations only; normal data APIs should still require an account context unless explicitly designated as superadmin-only.
- **Default account for single-tenant:** For single-tenant installs, one Account row can exist and login can set `accountId` to that account by default so no UI change is required.

---

## 5) Migration & rollout strategy

### 5.1 Recommended migration order

1. **Create Accounts and AccountMembers** — Add Accounts table; add AccountMembers (AccountID, UserID, RoleID, …). No AccountID on Users.
2. **Create default account and backfill AccountMembers** — Single default account; backfill one AccountMembers row per existing User with current RoleID.
3. **Add AccountID to tenant-owned tables** — In dependency order: Accounts-owned first (Clients, Projects, Warehouses), then Sheets and all sheet-descendant tables, then Inventory*, Estimation*, AuditLogs, ChangeLogs, ExportJobs, Notifications, Parties, MirrorTemplates. Add column as NOT NULL where backfill is done, or NULL then backfill then alter to NOT NULL.
4. **Backfill AccountID** — For each tenant-owned table, set AccountID = (default account ID) for all existing rows.
5. **Add unique constraints and FKs** — (AccountID, X) uniques; FKs to Accounts(AccountID) where planned.
6. **Application code** — Thread `req.user.accountId` and add WHERE AccountID = @AccountID (and INSERT AccountID) in all services/repositories listed in §4. Deploy after migrations.

### 5.2 Backfill strategy for existing rows

- **Single-tenant (one account):** Create one Account row (e.g. “Default” or org name). Set every tenant-owned row’s AccountID to that AccountID. All existing users get one AccountMembers row linking them to that account with their current RoleID.
- **Multi-tenant (future):** If splitting existing data into multiple accounts, a separate data migration script must assign each row to the correct AccountID (e.g. by business rule or manual mapping); out of scope for this document.

### 5.3 Single-tenant installs during migration

- Keep one default account; all existing data and users belong to it. No change in user experience: login can auto-select the only account or default account so `req.user.accountId` is always set and all queries work. No UI for “account switcher” required for single-tenant. This allows the same codebase to run in single-tenant (one account) and multi-tenant (multiple accounts) mode.

---

## 6) Non-goals

- **No implementation** — This document is planning only; no code or schema changes are made.
- **No code changes** — No edits to backend, frontend, or migrations in this step.
- **No UI changes** — No account switcher, account creation, or account settings UI is specified here.
- **No per-account custom roles** — Roles and the role × permission matrix remain fixed per Phase 2.5 Step A; custom roles or per-account permission tweaks are explicitly out of scope and are restated here as non-goals.

---

**End of document.**
