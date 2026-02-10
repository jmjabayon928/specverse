# 📐 SpecVerse Architecture

> This document is the canonical **engineering architecture** reference for SpecVerse.
>
> - **README.md** is optimized for onboarding + product overview + quick start.
> - **ARCHITECTURE.md** is optimized for maintainers: system design, invariants, contracts, governance boundaries, data model intent, and quality gates.

---

## 1) System Overview

SpecVerse is a production-grade engineering system of record for EPC, industrial, and facilities projects. It unifies engineering datasheets, schedules, estimations, inventory, verification records, and exports into an auditable, multi-tenant platform.

**What makes SpecVerse different** is that it treats engineering artifacts as **structured, lifecycle-aware entities** (not static documents), enabling consistent governance, revision control, QA/QC evidence, downstream cost impact, and future AI-assist workflows—without sacrificing accountability.

---

## 2) Architectural Goals (Non‑Negotiables)

SpecVerse is deliberately engineered around these constraints:

### 2.1 Correctness and integrity over convenience

- Engineering data must remain **internally consistent**.
- Write operations that change a “compound object” should be **atomic**.
- The backend should prefer “replace-all / transactional writes” over partial mutation patterns when data integrity is at risk.

### 2.2 Multi‑tenant isolation

- Account boundaries must be enforced in **API handlers, queries, and persistence**.
- Tenant isolation should be difficult to bypass accidentally.

### 2.3 Governance and least privilege

- “Keys to the kingdom” actions are protected by explicit authority checks.
- Operator / support access is **platform-scoped** and must not silently become account-scoped authority.

### 2.4 Traceability and auditability

- Critical actions are recorded in audit logs.
- Exports and approvals should leave **evidence trails** suitable for QA/QC and compliance workflows.

### 2.5 Extensibility without schema churn

- Template-driven configuration must allow new datasheet/schedule formats without rewriting the application.

### 2.6 Test stability

- Tests should be resilient to refactors and avoid cascade failures.
- Shared test helpers should prevent drift and repeated mocking strategies.

---

## 3) High-Level Architecture

### 3.1 Component map

- **Frontend:** Next.js (App Router)
- **Backend:** Node.js + Express (TypeScript)
- **Database:** Microsoft SQL Server
- **Auth:** JWT-based session (cookie or Authorization header), server-enforced RBAC
- **Exports/Jobs:** Background job patterns for large downloads/exports (where applicable)
- **Audit:** Centralized insert path + middleware hooks for request/response logging

### 3.2 Text diagram

```text
┌───────────────────────────────┐
│           Browser             │
│   Next.js App Router UI       │
└───────────────┬───────────────┘
                │ HTTP (JSON)
                ▼
┌───────────────────────────────┐
│        Express Backend         │
│  Controllers → Services → DB   │
│  RBAC / Governance / Audits    │
└───────────────┬───────────────┘
                │ SQL
                ▼
┌───────────────────────────────┐
│         SQL Server DB          │
│ Accounts, Members, Roles,      │
│ Permissions, Datasheets, etc.  │
└───────────────────────────────┘
```

---

## 4) Backend Architecture (Code Organization)

### 4.1 Layering model

SpecVerse follows a conventional layered backend structure:

- **Routes**: define URL surface + middleware chain
- **Controllers**: request parsing, validation, mapping HTTP → service calls
- **Services**: business rules, transaction boundaries, orchestration
- **Repositories / database query modules**: SQL access (parameterized queries only)
- **Middleware**: auth, tenant scoping, auditing, error handling

### 4.2 Transaction boundaries

Use explicit SQL transactions when:

- A workflow updates multiple rows/tables as part of a single logical operation
- Invariants must remain consistent (e.g., single-owner invariant)
- A “replace-all” update must be atomic

---

## 5) Multi‑Tenancy, Roles, Permissions, and Governance

This section is the **authoritative explanation** of “who can do what” and why.

### 5.1 Terms

- **Account**: tenant boundary (organization / environment boundary)
- **Account member**: a user’s membership inside an account
- **Role**: permission bundle assigned to a member in an account
- **Permission**: granular capability enforced by middleware/guards
- **Owner**: the _account_’s primary authority for “keys to the kingdom”
- **Platform Admin (Superadmin)**: platform operator for account maintenance/support actions

### 5.2 Authority domains

#### A) Account-scoped authority (tenant domain)

These actions operate **inside a specific account**:

- Create/modify templates
- Create/modify filled sheets
- Inventory, estimation, exports, approvals
- Member role changes (when allowed)
- Account-scoped administration (Admin role)

**Admin role** is a _role within an account_.

- Admin commonly maps to “all permissions” **within that account scope**.
- Admin is not the platform owner of the system.

#### B) Platform-scoped authority (operator domain)

Platform Admin is intended for **support / ops** tasks:

- Fix account access incidents
- Restore or repair account ownership/admin access
- Perform safe account maintenance
- Operate platform endpoints that do not rely on account membership

Platform Admin is **not** a role within an account.

- Platform Admin **must not** silently become “Admin for every account” unless explicitly designed (generally discouraged).
- Platform Admin endpoints should not depend on account-scoped context unless a very deliberate “impersonation / break-glass” design is implemented with strong auditing.

### 5.3 Account Owner (not a role)

Owner is not a role; it is modeled explicitly:

- `Accounts.OwnerUserID`
- `AccountMembers.IsOwner`

**Invariants**

- **Single owner invariant**: exactly one owner per account.
- Owner cannot be deactivated in ways that orphan the account.
- Ownership transfer must be transactional and atomic.

### 5.4 Hybrid Governance (Option B)

The governance policy used:

**Owner-only (“keys to the kingdom”)**

- Transfer ownership
- Disable / delete account
- Billing authority (future)

**Permission-based (not owner-only)**

- Member role changes
- Member activation/deactivation
- Other admin actions

### 5.5 Why this matters

Large multi-tenant systems frequently fail when:

- Account authority and platform authority are conflated
- “Support users” can accidentally act as “admins everywhere”
- The UI guesses privilege state based on incomplete session data

SpecVerse avoids this by:

- Keeping platform authority orthogonal to account RBAC
- Enforcing owner-only actions with explicit invariants
- Exposing session scope explicitly so the UI does not guess

---

## 6) Authentication, Session, and Context Attachment

### 6.1 Token sources

JWT may be provided via:

- Cookie token
- Authorization header (`Bearer <token>`)

### 6.2 Request user (`req.user`) contract

At minimum, after token verification the request has:

- `userId`
- identity fields (email/name/profilePic where available)

For **account-scoped routes**, the backend attaches account context:

- `accountId`
- `roleId`, `roleName`
- `permissions[]`
- `isOwner`, `ownerUserId`

For **platform routes**, the system should avoid requiring account context:

- Use token verification without forcing account membership
- Use platform-admin checks against `PlatformAdmins`

### 6.3 Platform admin detection

Platform admin detection should be sourced from:

- The **PlatformAdmins table** (primary, durable)
- Optional ENV overrides (for bootstrap / emergency)

**Important**: platform admin is distinct from account admin.

### 6.4 Session response design

The session endpoint should expose scope explicitly so the UI can gate features deterministically.

Recommended fields (and already aligned with recent hardening work):

- `accountId`, `roleId`, `roleName`
- `permissions[]`, `permissionsCount`
- `isOwner`, `ownerUserId`
- `isPlatformAdmin` (platform scope flag)
- keep `isSuperadmin` only for backward compatibility if needed

---

## 7) Platform Superadmin (Support / Ops)

### 7.1 Purpose

Platform endpoints exist to support operations without requiring account membership. Examples:

- Grant / revoke platform admin access
- Perform account maintenance workflows (future)
- Safe platform diagnostics (future)

### 7.2 Security posture

- Require authentication (token verified)
- Require platform admin check (DB-driven)
- Prefer explicit endpoints with strict auditing
- Prevent foot-guns:
  - no self-revoke
  - explicit 409 when already active
  - strict parameter validation

### 7.3 Auditing platform actions

Platform actions must write to the audit system, capturing:

- action name (e.g., `PLATFORM_ADMIN_GRANT`, `PLATFORM_ADMIN_REVOKE`)
- performedBy (actor userId)
- recordId (target userId)
- route/method/statusCode
- changes metadata

---

## 8) Audit Logging and Traceability

SpecVerse is audit-first. Audit mechanisms generally include:

- middleware capturing route/method/status codes
- explicit audit calls in sensitive workflows (governance, platform)

Audit goals:

- support QA/QC evidence
- enable forensic debugging
- provide a compliance-ready trail

**Guidance**:

- For high-risk actions, prefer explicit, structured audit entries
- Ensure audit entries can be correlated to entities (tableName + recordId)
- Prefer deterministic shapes and avoid “opaque blobs” when possible

---

## 9) Exports, Jobs, and Large Operations

Large operations (exports, bulk downloads) should be designed to:

- avoid blocking requests
- provide job status, retry, cancellation where appropriate
- secure downloads (signed URLs, expiry windows)
- leave audit trails

---

## 10) Internationalization

SpecVerse supports multilingual engineering environments, including:

- UI translations
- template translations (field labels, subsheets)
- export correctness (language-aware outputs)

---

## 11) AI Foundation and Continuous Intelligence (Architecture Vision)

SpecVerse is designed to support AI-assisted insights without violating engineering accountability:

- AI should suggest, summarize, and flag inconsistencies
- Decisions remain attributable to humans
- AI outputs should be explainable and auditable

---

## 12) Testing Strategy and Quality Gates

### 12.1 What must always pass

- `npm run lint`
- `npm run type-check`
- `npm test -- --runInBand --no-cache`
- `npm run build`

### 12.2 Test architecture principles

- Shared helpers to avoid drift (especially auth)
- Deterministic fixtures (no time dependence, no randomness)
- Small, boring helpers that reduce copy-paste
- Avoid snapshot tests for APIs

### 12.3 Shared helpers (core)

- `tests/helpers/authMiddlewareMock.ts` – shared auth harness (required)
- `tests/helpers/httpAsserts.ts` – standardized HTTP status assertions
- `tests/helpers/permissions.ts` – permission-surface helpers
- `tests/helpers/fixtures.ts` – explicit factories and constants

Rule:

> No test suite should re-invent auth mocking; it must use the shared helper.

---

## 13) Operational Model: Branches, Environments, and Releases

SpecVerse uses:

- `main` as production branch
- `staging` as staging branch

Recommended practice:

- CI on both branches
- staging used for pre-prod validation
- production releases via main

---

## Appendix A — README Reference

The project README (`README.md`) remains the canonical source for:

- Project overview
- Feature list and roadmap
- Setup and run instructions
- Phase tracking and delivery status
- AI vision and product direction

This architecture document intentionally avoids duplicating that content
to prevent documentation drift.

See: `README.md`

---

## 👨‍💼 Author

### **Jeff Martin Abayon**

### 📍 Calgary, Canada

### 📧 [jmjabayon@gmail.com](mailto:jmjabayon@gmail.com)

### [LinkedIn Profile](https://www.linkedin.com/in/jeff-martin-abayon-calgary/)
