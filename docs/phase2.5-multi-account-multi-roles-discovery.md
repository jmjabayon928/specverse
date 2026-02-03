# Phase 2.5 — Multi-Account + Multi-Roles: Deep Discovery Report

**Branch:** main (v0.5.4)  
**Scope:** Read-only discovery; no code or schema changes.  
**Goal:** Precise technical baseline for planning Phase 2.5 (multi-tenant accounts + account-scoped roles/permissions) before Phases 3–6.

---

## 1) Executive summary

- **Auth:** Identity is JWT in `token` cookie (or `Authorization` header). Session is stateless: no server-side session store; `req.user` is populated from JWT by `verifyToken` middleware. Login issues 60-minute cookie; no refresh token flow.
- **Session source of truth:** Backend `GET /api/backend/auth/session` returns `userId`, `roleId`, `role`, `name`, `email`, `profilePic`, `permissions`. Frontend uses `useSession()` (client) and `requireSession()` / `requireAuth()` / `sessionUtils.server` (server) and caches session per page lifecycle.
- **Authorization:** Permission checks use `requirePermission(permissionKey)` (DB lookup via `checkUserPermission(userId, permissionKey)`). Role checks use `requireAdmin` (hardcoded `role === 'admin'`) and frontend `SecurePage` (requiredRole or requiredPermission; Admin bypasses missing permission).
- **RBAC model:** Tables `Users`, `Roles`, `Permissions`, `RolePermissions`. User → Role (1:1); Role → Permissions (many-to-many). Permissions are resolved at login and embedded in JWT; route middleware checks DB for `requirePermission`.
- **No tenant/account scope:** No `AccountID` or tenant column found in codebase or migrations. All queries assume a single global scope (single tenant).
- **Enforcement points:** Backend: every API route uses `verifyToken`; many add `requirePermission(key)` or `requireAdmin`. Frontend: `SecurePage` on admin pages (permission or role), sidebar filters by role list, `canSeeApproveUI()` (Supervisor never sees Approve; others need `DATASHEET_APPROVE`).
- **Estimation routes:** Use only `verifyToken`; no `requirePermission` (estimation permissions exist in constants but are not enforced on estimation routes).
- **Admin override:** Frontend allows Admin to access pages even when the required permission is missing (with console warning); backend has no equivalent—403 if permission check fails.
- **Critical for Phase 2.5:** Introduce `Accounts` (or equivalent) and `AccountID` on Users and on all account-owned tables; scope Roles/Permissions per account (or keep global permission definitions with account-scoped role assignments); ensure every account-owned query is filtered by account context from session.
- **Global vs tenant-owned:** Reference/lookup tables (UOMs, Categories, Disciplines, DatasheetSubtypes, ValueContexts, NoteTypes, translations, Manufacturers, Suppliers, Areas, etc.) are currently global; Sheets, SubSheets, InformationTemplates/Values/ValueSets, Inventory*, Estimations*, AuditLogs, ExportJobs, Notifications, etc. should become tenant-scoped.
- **Phase 3–6:** No in-repo spec found for Phases 3–6. The draft matrix below maps named phases (Verification & Inspection, Ratings & Nameplate, Instrumentation & Loop, Equipment Schedules & Facilities) to proposed permissions and roles.
- **Prerequisites for Phase 2.5:** (1) Add Accounts table and AccountID to Users; (2) decide role/permission scope (per-account roles vs global roles with account membership); (3) add AccountID to all tenant-owned tables and backfill; (4) thread account context from auth (e.g. `req.user.accountId`) and apply to all relevant queries; (5) unify estimation route protection with permission checks if desired.

---

## 2) Auth/session findings

### 2.1 File paths

| Concern | Files |
|--------|--------|
| Session creation / validation | `src/backend/controllers/authController.ts`, `src/backend/services/authService.ts`, `src/backend/middleware/authMiddleware.ts` |
| Login / logout / cookie | `authController.ts` (loginHandler, logoutHandler), `authService.ts` (loginWithEmailAndPassword, JWT sign) |
| Session endpoint | `src/backend/routes/authRoutes.ts` — `GET /session` (verifyToken + getSession) |
| JWT payload type | `src/domain/auth/JwtTypes.ts` |
| Session type (frontend) | `src/domain/auth/sessionTypes.ts` |
| Frontend session fetch | `src/hooks/useSession.ts`, `src/utils/requireSession.ts`, `src/utils/sessionUtils.server.ts` |
| Permissions for JWT | `src/backend/database/permissionQueries.ts` (getUserPermissions), called from authService.buildTokenPayload |

### 2.2 Data flow (text)

```
Login:
  Client POST /api/backend/auth/login { email, password }
    → authController.loginHandler
    → authService.loginWithEmailAndPassword
      → findUserByEmail (Users + Roles)
      → bcrypt.compare(password, PasswordHash)
      → getUserPermissions(userId)  [RolePermissions → Permissions]
      → buildTokenPayload → jwt.sign(payload, JWT_SECRET, { expiresIn: '60m' })
    → res.cookie('token', token, { httpOnly, secure, sameSite: 'lax', path: '/', maxAge: 60*60*1000 })
    → res.json({ user: payload })

Session (every protected request):
  Client GET /api/backend/auth/session (credentials: include → cookie sent)
    → Next.js rewrites /api/backend/* → http://localhost:5000/api/backend/*
    → Express: cookieParser() → authRoutes: verifyToken
      → token = req.cookies.token || req.headers.authorization?.split(' ')[1]
      → jwt.verify(token, JWT_SECRET) → decoded
      → req.user = { userId, roleId, role, email, name, profilePic, permissions }
    → getSession reads req.user, returns same shape as JSON

Frontend session usage:
  - useSession(): on pathname change (except /login), fetch /api/backend/auth/session, setState(user); no refresh.
  - requireSession(): client; fetches once, caches in module-level cachedSession/cachedSessionPromise.
  - sessionUtils.server.requireAuth() / getUserSession(): server; read cookie, fetch NEXT_PUBLIC_API_BASE_URL/api/backend/auth/session with Cookie header.
```

### 2.3 Fields on req.user / session user

From `authMiddleware` and `JwtTypes` / `sessionTypes`:

- **userId** (number) — UserID
- **roleId** (number) — RoleID
- **role** (string) — RoleName (e.g. 'Admin', 'Engineer')
- **email** (string, optional)
- **name** (string, optional)
- **profilePic** (string | undefined)
- **permissions** (string[] — permission keys from role)

No `accountId` or tenant identifier.

### 2.4 Risks / assumptions

- **No refresh token:** 60-minute expiry forces re-login; no silent refresh.
- **Permissions in JWT:** Permission list is fixed at login; role/permission changes require re-login (or a short TTL + refresh).
- **Single origin for API:** Rewrites target `localhost:5000`; production must configure correct backend URL and CORS/cookie domain.
- **Admin bypass only on frontend:** Backend always enforces `requirePermission`; Admin can see UI for a page but get 403 if the Admin role lacks that permission in DB.
- **Session cache:** Client `requireSession` caches per lifecycle; role/permission changes mid-session are not reflected until reload or re-fetch.

---

## 3) Roles/permissions findings

### 3.1 Tables involved

- **Users** — UserID, FirstName, LastName, Email, PasswordHash, RoleID, ProfilePic (no AccountID).
- **Roles** — RoleID, RoleName (unique).
- **Permissions** — PermissionID, PermissionKey, Description (and AssignedCount in list).
- **RolePermissions** — RoleID, PermissionID (many-to-many).

Inferred from: `authService.ts`, `permissionQueries.ts`, `rolesService.ts`, `permissionsService.ts`, `usersService.ts`.

### 3.2 Backend enforcement points

| Middleware / pattern | File | Usage |
|----------------------|------|--------|
| verifyToken | `src/backend/middleware/authMiddleware.ts` | All protected routes; sets req.user from JWT. |
| optionalVerifyToken | Same | Export download route (session or token param). |
| requirePermission(key) | Same | Async; calls checkUserPermission(req.user.userId, permissionKey); 403 if false. |
| requireAdmin | `src/backend/middleware/requireAdmin.ts` | After verifyToken; 403 if req.user.role !== 'admin'. |

**Routes using requireAdmin only (no requirePermission):**  
`adminRoutes.ts`: POST `/users/:userId/reset-password`.  
`auditLogsRoutes.ts`: GET `/` (list audit logs).

**Routes using verifyToken only (no permission):**  
Users, Roles, Permissions, Projects, Clients, Manufacturers, Suppliers, Categories, Layout, Estimation (all), Sheet (value-set routes not audited here), Notification, etc.

**Routes using verifyToken + requirePermission:**  
Templates, FilledSheets, ValueSets, SheetLogs, Stats, Reports, Inventory, ExportJobs (INVENTORY_VIEW + requireAdmin for cleanup).

### 3.3 Frontend enforcement points

| Location | Mechanism |
|----------|------------|
| **SecurePage** | `src/components/security/SecurePage.tsx` — requiredRole or requiredPermission; redirect to /unauthorized if check fails; Admin bypass for missing permission (with warn). |
| **AppSidebar** | `src/layout/AppSidebar.tsx` — nav items and subItems have `roles?: string[]`; filter by `user?.role?.toLowerCase()` so only matching roles see the link. |
| **approveGating** | `src/utils/approveGating.ts` — `canSeeApproveUI(user)`: false if role === 'Supervisor'; else true if permissions includes 'DATASHEET_APPROVE'. |
| **TemplateActions** | `src/components/datasheets/templates/TemplateActions.tsx` — hasPermissions, userHasPermission for DATASHEET_EDIT, DATASHEET_VERIFY, DATASHEET_CREATE, DATASHEET_EXPORT, FILLED_CREATE/SHEET_CREATE for "Create filled". |
| **FilledSheetActions** | `src/components/datasheets/filled/FilledSheetActions.tsx` — hasPermission for DATASHEET_EDIT, DATASHEET_VERIFY, DATASHEET_CREATE, DATASHEET_EXPORT, DATASHEET_VIEW. |

### 3.4 Current permission keys (backend route usage)

From grep of `requirePermission('...')` and `requirePermission("...")` in `src`:

| Key | Used in routes |
|-----|-----------------|
| DATASHEET_VIEW | templateRoutes, filledSheetRoutes, valueSetRoutes, sheetLogsRoutes |
| DATASHEET_EDIT | templateRoutes, filledSheetRoutes, valueSetRoutes |
| DATASHEET_VERIFY | templateRoutes, filledSheetRoutes |
| DATASHEET_APPROVE | templateRoutes, filledSheetRoutes |
| DATASHEET_NOTE_EDIT | templateRoutes, filledSheetRoutes |
| DATASHEET_ATTACHMENT_UPLOAD | templateRoutes, filledSheetRoutes |
| DATASHEET_ATTACHMENT_DELETE | filledSheetRoutes |
| DASHBOARD_VIEW | statsRoutes, reportsRoutes |
| INVENTORY_VIEW | inventoryRoutes, exportJobsRoutes |
| INVENTORY_CREATE | inventoryRoutes |
| INVENTORY_EDIT | inventoryRoutes |
| INVENTORY_DELETE | inventoryRoutes |
| INVENTORY_MAINTENANCE_VIEW | inventoryRoutes |
| INVENTORY_MAINTENANCE_CREATE | inventoryRoutes |
| INVENTORY_TRANSACTION_CREATE | inventoryRoutes |

**Frontend-only (SecurePage or component checks, no backend requirePermission for that key):**  
DATASHEET_CREATE (create page, TemplateActions, FilledSheetForm).  
FILLED_CREATE, SHEET_CREATE, DATASHEET_EXPORT (TemplateActions / FilledSheetActions for buttons).

### 3.5 Constants vs usage

`src/constants/permissions.ts` defines: TEMPLATE_*, DATASHEET_*, REVISIONS_VIEW, ESTIMATION_*, INVENTORY_* (no DASHBOARD_*, no INVENTORY_MAINTENANCE_*, no INVENTORY_TRANSACTION_*). Backend uses keys that are not all in this constant file (e.g. DASHBOARD_VIEW, INVENTORY_MAINTENANCE_VIEW); alignment is incomplete.

### 3.6 Current roles (where they appear)

| Role (as used) | Where |
|----------------|--------|
| Admin | requireAdmin (backend), SecurePage override (frontend), audit-logs requiredRole, AppSidebar Administration section (roles: ['admin']), exportJobsController isOwnerOrAdmin, dev seed-admin. |
| Supervisor | approveGating (cannot see Approve UI), AppSidebar (Dashboard, DataSheets, Estimation, Inventory). |
| Engineer | AppSidebar (DataSheets, Estimation, Inventory). |
| Estimator | AppSidebar (Dashboard, Estimation). |
| Manager | AppSidebar (Dashboard, Estimation). |
| User | AppSidebar (Dashboard). |
| QA | AppSidebar (DataSheets). |
| Warehouse | AppSidebar (Inventory). |
| Maintenance | AppSidebar (Inventory). |

Role names in DB come from `Roles.RoleName`; sidebar uses lowercase for comparison. No AccountID on Roles today—roles are global.

---

## 4) Tenant scoping analysis

### 4.1 Table classification (global vs tenant-owned vs hybrid)

**Assumption:** No AccountID exists in the repo or migrations. Classification is by intended ownership for Phase 2.5.

**Global (reference / lookup — typically no AccountID or shared across accounts):**

- Roles, Permissions, RolePermissions (if permission set stays global; else account-scoped roles per account).
- Categories, Disciplines, DatasheetSubtypes, NoteTypes, ValueContexts.
- Manufacturers, Suppliers, Areas (or could be per-account; product choice).
- UOM / translation tables: SheetTranslations, SubsheetTranslations, InfoTemplateTranslations, InfoOptionTranslations (i18n).
- Label/language reference data used by labelRoutes, languageRoutes.

**Tenant-owned (should get AccountID and be scoped by account):**

- Users (link to Account; role assignment may be per-account).
- Sheets, SubSheets, InformationTemplates, InformationTemplateOptions, InformationValues, InformationValueSets, ValueSetFieldVariances.
- Attachments, SheetAttachments, SheetNotes, SheetRevisions, SheetHeaderKV, Layout-related (DatasheetLayouts, LayoutRegions, LayoutBlocks, LayoutSubsheetSlots, LayoutBodySlots) if tied to account’s templates.
- InventoryItems, Inventory, Warehouses, InventoryTransactions, InventoryMaintenanceLogs, InventoryAuditLogs.
- Estimations, EstimationPackages, EstimationItems, EstimationItemSupplierQuotes, EstimationSuppliers, etc.
- AuditLogs, ChangeLogs.
- ExportJobs, Notifications, NotificationRecipients.
- Projects, Clients (often account-scoped in multi-tenant).
- Export jobs (CreatedBy + file storage) — scope by account.

**Hybrid / to be decided:**

- Users: one row per human; AccountID (or AccountMembership table) for which account(s) they belong to and which role in each.
- Roles: global role definitions vs per-account role instances (e.g. "Engineer" per account with different permission sets).

### 4.2 Code hotspots (repositories / services / controllers that assume no tenant)

All current queries assume a single scope. High-impact areas for adding account scope:

- **authService** — findUserByEmail: no account filter; login must become account-aware (e.g. email + account or account in context).
- **permissionQueries** — getUserPermissions, checkUserPermission: Users → Roles → RolePermissions → Permissions; no AccountID; must scope by account when roles/permissions are per-account.
- **userQueries / usersService** — list/get/create/update users; no AccountID filter.
- **templateQueries / templateService** — Sheets and all template/filled structure; no AccountID.
- **filledSheetService** — Sheets, SubSheets, InformationTemplates/Values/ValueSets; no AccountID.
- **valueSetQueries** — InformationValueSets, ValueSetFieldVariances; no AccountID.
- **inventoryQueries, inventoryTransactionQueries, inventoryMaintenanceQueries, inventoryAuditQueries** — no AccountID.
- **estimationQueries, estimationPackageQueries, estimationItemQueries, estimationQuoteQueries** — no AccountID.
- **auditQueries** — AuditLogs; no AccountID.
- **exportJobQueries** — ExportJobs; no AccountID (only CreatedBy).
- **projectsService / projectQueries** — Projects, Clients; no AccountID.
- **layoutService** — DatasheetLayouts, LayoutRegions, etc.; no AccountID.
- **notificationQueries / notifyUsers** — Notifications; no AccountID.
- **ReferenceQueries** — Areas, Users, Manufacturers, Suppliers, Categories, Clients, Projects, Warehouses; currently global; if any become per-account, these need AccountID.

Any cross-table join that touches the above (e.g. Sheets ↔ Clients, Sheets ↔ Users) will need account filter on the tenant-owned side and consistent AccountID on both sides.

---

## 5) Draft role & permission matrix (Phase 2.5 + Phases 3–6)

### 5.1 Roles (small stable set)

Proposed set that supports current app + Phases 3–6 (engineering org):

- **Admin** — Full access within account; user/role/permission management, audit, system settings.
- **Manager** — Oversight, reports, approvals where delegated; no user management.
- **Engineer** — Create/edit datasheets (templates + filled), verify; no approve (unless given).
- **Supervisor** — Review, verify; explicitly no Approve UI (current rule).
- **Estimator** — Estimation packages, quotes, costs.
- **QA** — View and verify; limited edit.
- **Warehouse** — Inventory view/transactions/maintenance (as today).
- **Maintenance** — Inventory maintenance view/create (as today).
- **Viewer** — Read-only (datasheets, inventory, dashboard).

### 5.2 Permission keys (consolidated list)

**Current (keep):**  
DATASHEET_VIEW, DATASHEET_EDIT, DATASHEET_CREATE, DATASHEET_VERIFY, DATASHEET_APPROVE, DATASHEET_NOTE_EDIT, DATASHEET_ATTACHMENT_UPLOAD, DATASHEET_ATTACHMENT_DELETE, DATASHEET_EXPORT.  
DASHBOARD_VIEW.  
INVENTORY_VIEW, INVENTORY_CREATE, INVENTORY_EDIT, INVENTORY_DELETE, INVENTORY_MAINTENANCE_VIEW, INVENTORY_MAINTENANCE_CREATE, INVENTORY_TRANSACTION_CREATE.  
(Optional: ESTIMATION_VIEW, ESTIMATION_CREATE, ESTIMATION_EDIT, etc., if enforced.)

**Phase 3 — Verification & Inspection Records:**  
VERIFICATION_VIEW, VERIFICATION_CREATE, VERIFICATION_EDIT, VERIFICATION_VERIFY, INSPECTION_VIEW, INSPECTION_CREATE, INSPECTION_EDIT.

**Phase 4 — Ratings & Nameplate Modeling:**  
RATINGS_VIEW, RATINGS_EDIT, NAMEPLATE_VIEW, NAMEPLATE_EDIT.

**Phase 5 — Instrumentation & Loop Awareness:**  
INSTRUMENTATION_VIEW, INSTRUMENTATION_EDIT, LOOPS_VIEW, LOOPS_EDIT.

**Phase 6 — Equipment Schedules & Facilities Engineering:**  
SCHEDULES_VIEW, SCHEDULES_EDIT, FACILITIES_VIEW, FACILITIES_EDIT, EQUIPMENT_SCHEDULE_EXPORT.

### 5.3 Matrix (role → permissions) — summary

| Role       | Datasheet (view/edit/create/verify/approve/export) | Dashboard | Inventory (view/create/edit/delete/maintenance/transaction) | Estimation | Verification / Inspection (Ph3) | Ratings / Nameplate (Ph4) | Instrumentation / Loops (Ph5) | Schedules / Facilities (Ph6) | User/Role mgmt |
|------------|---------------------------------------------------|----------|-------------------------------------------------------------|------------|-------------------------------|----------------------------|------------------------------|------------------------------|----------------|
| Admin      | All                                                | ✓        | All                                                         | All        | All                           | All                        | All                          | All                          | ✓             |
| Manager    | View, export; no approve (or delegated)            | ✓        | View                                                        | View/edit  | View, verify                  | View, edit                 | View, edit                   | View, export                 | —             |
| Engineer   | View, edit, create, verify; no approve              | ✓        | View, transaction                                           | View       | Create, edit, verify           | Edit                       | Edit                         | Edit                         | —             |
| Supervisor | View, verify; no approve (hard rule)                | ✓        | View, maintenance                                           | View       | View, verify                  | View                        | View                         | View                         | —             |
| Estimator  | View                                                | ✓        | View                                                        | All        | View                          | View                        | —                            | —                            | —             |
| QA         | View, verify                                       | ✓        | View                                                        | View       | View, verify, edit            | View                        | View                         | View                         | —             |
| Warehouse  | —                                                  | —        | View, create, edit, transaction                             | —          | —                             | —                          | —                            | —                            | —             |
| Maintenance| —                                                  | —        | View, maintenance view/create                               | —          | —                             | —                          | —                            | —                            | —             |
| Viewer     | View                                                | ✓        | View                                                        | View       | View                          | View                        | View                         | View                         | —             |

(Exact permission keys per cell to be mapped when implementing; above is capability-level.)

---

## 6) Open questions / unknowns

1. **Production auth topology:** How is the backend deployed (same host vs separate)? Cookie domain and CORS for production are not visible in this repo.
2. **SQL Server schema dumps:** The report infers tables from code and migrations; no full schema dump was read. Confirm Users/Roles/Permissions/RolePermissions column set and indexes from actual DB.
3. **Seed data:** Which roles and permissions are seeded (e.g. by dev seed or migration)? No seed file for Permissions/RolePermissions was found in migrations.
4. **Phase 3–6 specs:** No documents in repo describe Phases 3–6 in detail; the matrix is a placeholder from phase names only. Confirm required actions (create/edit/verify/approve/view/export) per phase with product.
5. **Account model:** Whether "account" is a top-level tenant (company) or also supports sub-units (e.g. divisions) is unknown; affects whether AccountID is the only tenant key.
6. **Layouts:** Whether DatasheetLayouts are per-account or shared (e.g. by template) affects table classification.

---

**End of report. No code or schema changes were made.**
