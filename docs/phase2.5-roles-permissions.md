# Phase 2.5 — Roles & Permissions (RBAC Contract)

## 1) Title and purpose

**Phase 2.5** introduces multi-tenant accounts and account-scoped roles and permissions. Goals include:

- Introduce an **Account** (tenant) boundary so all account-owned data is scoped by `AccountID`.
- Define a **canonical set of account roles** and **permission keys** that are consistent across backend and frontend.
- Enforce permissions at API and UI so that access is predictable and auditable per account.

**This document** is the **RBAC contract**: the single source of truth for system vs account roles, canonical account roles, canonical permission keys, the role × permission matrix, and security invariants. Implementations (backend routes, frontend gates, DB seeds) must align to this contract.

---

## 2) System Roles (Out of Account Scope)

### Platform Superadmin

A **Platform Superadmin** is a special identity used for platform-level operations only. It is **out of account scope**.

- **Not stored in the Roles table** — It is not a row in `dbo.Roles` and is not part of the normal User → Role → Permissions chain.
- **Not assignable per account** — Account admins cannot create or assign a “Superadmin” role; it is configured outside the application’s account RBAC (e.g. via environment, external IdP, or platform bootstrap).
- **Bypasses AccountID scoping** — When acting as Superadmin, operations may cross accounts (e.g. tenant provisioning, platform-wide config, support/debug). Normal API and data access remain account-scoped for all other identities.
- **Used for platform operations only** — Examples: tenant lifecycle, platform health, global feature flags, emergency access. It does **not** replace the in-account **Admin** role for day-to-day account management.

Superadmin is documented here so that account-scoped RBAC (roles and permissions below) is clearly separate from platform-level privilege.

---

## 3) Canonical Account Roles

The following roles are the **canonical account roles**. They are stored in `dbo.Roles` (or equivalent) and assigned to users within an account. Descriptions and responsibility boundaries:

| Role | Description | Responsibility boundary |
|------|-------------|-------------------------|
| **Admin** | Full control within the account. | User and role management, account settings, audit access, all data and features. Does not imply platform Superadmin. |
| **Manager** | Oversight and reporting. | Dashboard, reports, estimation oversight, audit view. No user/role management; no datasheet edit/approve. |
| **Reviewer** | Review and verify only. (Maps from existing **Supervisor** in code/UI.) | Verify templates and filled sheets; **never** approve. View datasheets, dashboard, and related data. |
| **Engineer** | Author and verify datasheets. | Create and edit templates and filled sheets; verify; export. No approve unless explicitly granted. |
| **Estimator** | Estimation lifecycle. | Create and edit estimations, packages, quotes; export; view datasheets and dashboard for context. No datasheet edit/verify. |
| **QA** | Quality assurance. | View and verify datasheets; limited edit (e.g. notes, attachments). No approve. |
| **Warehouse** | Inventory operations. | View, create, edit, delete inventory items; create transactions. No datasheet or dashboard access by default. |
| **Maintenance** | Inventory maintenance. | View and create maintenance logs. No general inventory edit or datasheet access. |
| **Viewer** | Read-only. (Maps from existing **user** in sidebar.) | View dashboard, datasheets, inventory, estimation. No create, edit, verify, approve, or delete. |

---

## 4) Canonical Permission Keys

Final list from Phase 2.5 Step A, grouped by domain. For each key:

- **Description** — What the permission allows.
- **Current status** — `exists backend` / `frontend-only` / `missing` (no enforcement yet).

### Account

| Key | Description | Status |
|-----|-------------|--------|
| ACCOUNT_VIEW | View account settings / profile. | missing |
| ACCOUNT_EDIT | Edit account profile or settings. | missing |
| ACCOUNT_USER_MANAGE | Invite, remove, or change user role within the account. | missing |
| ACCOUNT_ROLE_MANAGE | Create or edit account roles and assign permissions. | missing |

### Datasheets

| Key | Description | Status |
|-----|-------------|--------|
| DATASHEET_VIEW | List and view templates and filled sheets; revisions; compare; sheet logs. | exists backend |
| DATASHEET_CREATE | Create new templates and create new filled sheets. | frontend-only |
| DATASHEET_EDIT | Update templates and filled sheets; structure (subsheets, fields); clone. | exists backend |
| DATASHEET_VERIFY | Submit verify on templates and filled sheets. | exists backend |
| DATASHEET_APPROVE | Submit approve on templates and filled sheets. | exists backend |
| DATASHEET_NOTE_EDIT | Add, edit, delete notes on templates and filled sheets. | exists backend |
| DATASHEET_ATTACHMENT_UPLOAD | Upload attachments to templates and filled sheets. | exists backend |
| DATASHEET_ATTACHMENT_DELETE | Delete attachments. | exists backend |
| DATASHEET_EXPORT | Export templates or filled sheets (e.g. PDF, Excel). | frontend-only |
| REVISIONS_VIEW | View revision list and revision diff. | missing |

### Dashboard

| Key | Description | Status |
|-----|-------------|--------|
| DASHBOARD_VIEW | Access dashboard, stats, and reports. | exists backend |

### Inventory

| Key | Description | Status |
|-----|-------------|--------|
| INVENTORY_VIEW | List and view items; transactions; audit logs. | exists backend |
| INVENTORY_CREATE | Create inventory items. | exists backend |
| INVENTORY_EDIT | Update inventory items. | exists backend |
| INVENTORY_DELETE | Delete inventory items. | exists backend |
| INVENTORY_MAINTENANCE_VIEW | View maintenance logs. | exists backend |
| INVENTORY_MAINTENANCE_CREATE | Create maintenance log entries. | exists backend |
| INVENTORY_TRANSACTION_CREATE | Create inventory transactions. | exists backend |

### Estimation

| Key | Description | Status |
|-----|-------------|--------|
| ESTIMATION_VIEW | List and view estimations, packages, quotes. | missing |
| ESTIMATION_CREATE | Create estimations and packages. | missing |
| ESTIMATION_EDIT | Update estimations, packages, items, quotes. | missing |
| ESTIMATION_EXPORT | Export estimation PDF/summary. | missing |

### Exports

| Key | Description | Status |
|-----|-------------|--------|
| EXPORT_VIEW | List and view status of export jobs. | missing |
| EXPORT_DOWNLOAD | Download export job output (today: owner or admin only, no key). | missing |
| EXPORT_CLEANUP | Run cleanup of expired export files (today: admin-only route). | exists backend (admin-only) |

### Audit

| Key | Description | Status |
|-----|-------------|--------|
| AUDIT_VIEW | View audit logs. (Today: requireAdmin only.) | missing |

### Phase 3 – Verification & inspection records

| Key | Description | Status |
|-----|-------------|--------|
| VERIFICATION_VIEW | View verification/inspection records. | missing |
| VERIFICATION_CREATE | Create verification records. | missing |
| VERIFICATION_EDIT | Edit verification records. | missing |
| INSPECTION_VIEW | View inspection data. | missing |
| INSPECTION_CREATE | Create inspections. | missing |
| INSPECTION_EDIT | Edit inspections. | missing |

### Phase 4 – Ratings & nameplate

| Key | Description | Status |
|-----|-------------|--------|
| RATINGS_VIEW | View ratings. | missing |
| RATINGS_EDIT | Edit ratings. | missing |
| NAMEPLATE_VIEW | View nameplate. | missing |
| NAMEPLATE_EDIT | Edit nameplate. | missing |

### Phase 5 – Instrumentation & loop awareness

| Key | Description | Status |
|-----|-------------|--------|
| INSTRUMENTATION_VIEW | View instrumentation. | missing |
| INSTRUMENTATION_EDIT | Edit instrumentation. | missing |
| LOOPS_VIEW | View loops. | missing |
| LOOPS_EDIT | Edit loops. | missing |

### Phase 6 – Equipment schedules & facilities

| Key | Description | Status |
|-----|-------------|--------|
| SCHEDULES_VIEW | View equipment schedules. | missing |
| SCHEDULES_EDIT | Edit schedules. | missing |
| FACILITIES_VIEW | View facilities. | missing |
| FACILITIES_EDIT | Edit facilities. | missing |
| SCHEDULES_EXPORT | Export schedules. | missing |

---

## 5) Role × Permission Matrix

Rows = canonical account roles. Columns = permission keys. **✓** = grant; **—** = deny.

### Account

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| ACCOUNT_VIEW | ✓ | ✓ | — | — | — | — | — | — | — |
| ACCOUNT_EDIT | ✓ | — | — | — | — | — | — | — | — |
| ACCOUNT_USER_MANAGE | ✓ | — | — | — | — | — | — | — | — |
| ACCOUNT_ROLE_MANAGE | ✓ | — | — | — | — | — | — | — | — |

### Datasheets

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| DATASHEET_VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| DATASHEET_CREATE | ✓ | — | — | ✓ | — | — | — | — | — |
| DATASHEET_EDIT | ✓ | — | — | ✓ | — | — | — | — | — |
| DATASHEET_VERIFY | ✓ | — | ✓ | ✓ | — | ✓ | — | — | — |
| DATASHEET_APPROVE | ✓ | — | — | — | — | — | — | — | — |
| DATASHEET_NOTE_EDIT | ✓ | — | — | ✓ | — | ✓ | — | — | — |
| DATASHEET_ATTACHMENT_UPLOAD | ✓ | — | — | ✓ | — | ✓ | — | — | — |
| DATASHEET_ATTACHMENT_DELETE | ✓ | — | — | ✓ | — | ✓ | — | — | — |
| DATASHEET_EXPORT | ✓ | ✓ | — | ✓ | — | ✓ | — | — | — |
| REVISIONS_VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |

### Dashboard

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| DASHBOARD_VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |

### Inventory

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| INVENTORY_VIEW | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ | ✓ |
| INVENTORY_CREATE | ✓ | — | — | — | — | — | ✓ | — | — |
| INVENTORY_EDIT | ✓ | — | — | — | — | — | ✓ | — | — |
| INVENTORY_DELETE | ✓ | — | — | — | — | — | ✓ | — | — |
| INVENTORY_MAINTENANCE_VIEW | ✓ | — | — | — | — | — | — | ✓ | — |
| INVENTORY_MAINTENANCE_CREATE | ✓ | — | — | — | — | — | — | ✓ | — |
| INVENTORY_TRANSACTION_CREATE | ✓ | — | — | — | — | — | ✓ | — | — |

### Estimation

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| ESTIMATION_VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ |
| ESTIMATION_CREATE | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| ESTIMATION_EDIT | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| ESTIMATION_EXPORT | ✓ | ✓ | — | — | ✓ | — | — | — | — |

### Exports

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| EXPORT_VIEW | ✓ | — | — | ✓ | — | — | ✓ | — | — |
| EXPORT_DOWNLOAD | ✓ | — | — | ✓ | — | — | ✓ | — | — |
| EXPORT_CLEANUP | ✓ | — | — | — | — | — | — | — | — |

### Audit

| Permission | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|------------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| AUDIT_VIEW | ✓ | ✓ | — | — | — | — | — | — | — |

### Phase 3–6 placeholders (summary)

| Domain | Admin | Manager | Reviewer | Engineer | Estimator | QA | Warehouse | Maintenance | Viewer |
|--------|:-----:|:-------:|:--------:|:--------:|:---------:|:--:|:---------:|:------------:|:------:|
| VERIFICATION_* / INSPECTION_* (view, create, edit) | ✓ | ✓ | view, verify | ✓ | — | ✓ | — | — | view |
| RATINGS_* / NAMEPLATE_* | ✓ | ✓ | view | ✓ | — | ✓ | — | — | view |
| INSTRUMENTATION_* / LOOPS_* | ✓ | ✓ | view | ✓ | — | ✓ | — | — | view |
| SCHEDULES_* / FACILITIES_* | ✓ | ✓ | view | ✓ | — | ✓ | — | — | view |

---

## 6) Security Invariants

1. **Reviewer never approves.** The Reviewer (Supervisor) role must never be granted `DATASHEET_APPROVE`. The UI must not show Approve actions for Reviewer regardless of permission list (current `canSeeApproveUI` behavior).

2. **Approve ≠ Verify.** Verify (`DATASHEET_VERIFY`) and Approve (`DATASHEET_APPROVE`) are distinct. Granting verify does not imply approve; roles that verify (Reviewer, Engineer, QA) do not automatically get approve.

3. **Only Admin manages users.** Only the Admin role receives `ACCOUNT_USER_MANAGE` and `ACCOUNT_ROLE_MANAGE`. No other account role can invite/remove users or change role/permission assignments within the account.

4. **Platform Superadmin bypasses account scope but does not replace Admin.** Superadmin is for platform operations only. In-account user/role management, account settings, and day-to-day data access remain under the account Admin role and this RBAC contract.

5. **Viewer is read-only.** The Viewer role receives only view permissions (e.g. DATASHEET_VIEW, DASHBOARD_VIEW, INVENTORY_VIEW, ESTIMATION_VIEW, and Phase 3–6 view placeholders). No create, edit, verify, approve, or delete.

---

## 7) Known Mismatches & Required Unification

These must be resolved in implementation so backend and frontend align with this contract:

| Mismatch | Current state | Target |
|----------|----------------|--------|
| **DATASHEET_CREATE vs EDIT** | Frontend gates create pages with `DATASHEET_CREATE`; backend uses `DATASHEET_EDIT` for POST create (templates and filled sheets). | Backend create routes should require `DATASHEET_CREATE` (or accept both CREATE and EDIT during transition). |
| **DATASHEET_EXPORT frontend-only** | Export buttons check `DATASHEET_EXPORT` on frontend; backend export routes have no permission check. | Add `DATASHEET_EXPORT` to backend export endpoints. |
| **TEMPLATE_VERIFY removal** | Template verify page checks `TEMPLATE_VERIFY`; backend uses `DATASHEET_VERIFY` for template verify. | Use `DATASHEET_VERIFY` everywhere; remove `TEMPLATE_VERIFY` from frontend and from permission list. |
| **Estimation permission gaps** | Estimation routes use only `verifyToken`; no permission keys. | Add `ESTIMATION_VIEW`, `ESTIMATION_CREATE`, `ESTIMATION_EDIT`, `ESTIMATION_EXPORT` to backend estimation routes. |
| **Audit requireAdmin → AUDIT_VIEW** | Audit log route uses `requireAdmin` only. | Introduce `AUDIT_VIEW` and enforce it; grant to Admin and Manager per matrix. |

---

## 8) Non-goals

- **No per-account custom role editor in Phase 2.5.** Roles and the role × permission matrix are fixed by this contract. Custom roles or per-account permission tweaks are out of scope.
- **No code changes in this step.** This document is design and contract only; implementation is a separate step.
- **No schema changes in this step.** No migrations or table changes are implied by publishing this document; schema work is part of Phase 2.5 implementation.
