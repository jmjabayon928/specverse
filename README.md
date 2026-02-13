# 📘 SpecVerse - Engineering Data & Estimation Platform

[![CI (main)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml)
[![CI (staging)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg?branch=staging)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml?branch=staging)
[![CI (release/v0.5)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg?branch=release/v0.5)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml?branch=release/v0.5)

## SpecVerse

SpecVerse is a production-grade engineering system of record for EPC, industrial, and facilities projects. It is designed for engineering teams, EPC firms, and asset-heavy organizations that need structured, auditable, and scalable control over engineering data across projects and disciplines.

It unifies datasheets, equipment specifications, schedules, estimations, inventory, verification records, and exports into a single, auditable, multi-tenant platform—designed to scale across disciplines, projects, and organizations.

Unlike traditional tools that treat datasheets as static documents, SpecVerse models engineering data as structured, lifecycle-aware entities with approvals, revisions, traceability, and downstream impact on cost, procurement, and operations.

## 🌟 Key Innovation — Dynamic Engineering Data, Not Static Forms

SpecVerse solves a long-standing engineering bottleneck:
- Every time a new datasheet or schedule format was needed, teams had to build a new app, spreadsheet, or database schema.
- SpecVerse eliminates this entirely.

At its core is a dynamic, no-code template engine:
- Datasheet and schedule structures are configurable at runtime
- Subsections, fields, units, rules, and workflows are defined without code
- No schema or application changes are required for new formats
- Engineers and admins—not developers—own and evolve templates

This enables true no-code engineering configuration, dramatically reducing custom development cost and tool sprawl while improving consistency, auditability, and reuse across projects.

## 🧭 Architectural Positioning

SpecVerse is intentionally designed as:
- A system of record — not a document repository or file manager
- A multi-tenant engineering platform with strict account isolation, roles, and permissions
- A QA/QC and compliance-ready foundation with approvals, verification records, audit trails, and exportable evidence
- An AI-ready platform that can evolve toward assistive intelligence without compromising engineering judgment or accountability

Every architectural decision — schema design, replace-all transactions, audit logging, permission enforcement, and comprehensive testing — reinforces these principles.

## 🧩 Core Modules

SpecVerse is a modular, multi-tenant engineering data platform designed to manage the full lifecycle of equipment data — from datasheets and procurement to verification, instrumentation, and facility-scale schedules.

### 📄 Datasheets (Multi-Discipline, Lifecycle-Aware)

Structured engineering datasheets form the backbone of SpecVerse.

#### **Capabilities**

* ✅ Create and manage datasheet templates with subsheets and typed information fields

* ✅ Fill datasheets with real project / equipment data

* ✅ Discipline-agnostic design (piping, instrumentation, mechanical, electrical, HVAC, etc.)

* ✅ Inline editing with unit validation (SI / USC support)

* ✅ Multi-language support (database-backed translations + i18next)

* ✅ Clone datasheets and track engineering revisions

* ✅ Approval workflow:

    - Draft → Rejected (optional) → Modified → Verified → Approved

* ✅ Support for Requirement vs Offered vs As-Built values

* ✅ Attachments:

    - Templates and filled datasheets

    - Filled sheets reference template attachments to avoid duplication

* ✅ Threaded notes and collaboration
    - Template notes automatically copied to filled sheets

* ✅ Full audit trail:
    - Template structure changes
    - Field value changes
    - Displayed in viewers and included in exports

* ✅ Export to PDF and Excel
    - Translated
    - Unit-converted
    - Includes audit trail section

* ✅ Account-scoped, multi-tenant enforcement

* ✅ AI-ready metadata and structure

**Outcome**
SpecVerse acts as a system of record for engineering datasheets, not just a document store.

### 📊 Estimations (Procurement-Aware)

Engineering estimation is tightly integrated with datasheets and inventory.

#### **Capabilities**

* ✅ Create project estimations with packages and line items

* ✅ Link items to datasheets and inventory

* ✅ Add and compare multiple supplier quotes

* ✅ Auto-compute totals and select winning quotes

* ✅ Filter by status, client, or project

* ✅ Approval workflow:

    - Draft → Verified → Approved

* ✅ Export:

    - Full report (PDF / Excel)
    - Summary reports
    - Procurement sheets (per package or full)

* ✅ Estimation analytics:

    - Cost breakdowns
    - Supplier comparison
    - Project totals

**Outcome**
SpecVerse bridges engineering definition and procurement decision-making.

### 🛆 Inventory (Asset-Linked)

Inventory management is asset-aware and datasheet-linked.

#### **Capabilities**

* ✅ Track inventory by item and warehouse

* ✅ Maintain quantity, logs, and metadata

* ✅ Link inventory items to datasheets and estimations

* ✅ Role-based access for maintenance and restocking

* ✅ Export inventory and usage trends (Excel)

* ✅ Inventory analytics:
    - Usage forecasts
    - Category breakdowns

**Outcome**
Inventory is treated as a live engineering resource, not a static stock list.

### 🧪 Verification & Inspection Records (QA / QC)

Verification is modeled as a first-class engineering object, not an afterthought.

#### **Capabilities**

* ✅ Verification and inspection records

* ✅ Standard-aware certification tracking

* ✅ Link records to:
    - Datasheets
    - Assets
    - Attachments

* ✅ Full auditability and traceability

*##* ✅ Account-scoped access control

**Outcome**
SpecVerse supports QA/QC, compliance, and inspection workflows with traceable evidence.

### 🎛 Instrumentation & Loop Awareness (Lightweight)

SpecVerse provides instrument and loop awareness without becoming a P&ID system.

#### **Capabilities**

* ✅ Instrument registry (account-scoped)

* ✅ Loop definitions and membership

* ✅ Canonical tag normalization (ISA-5.1 inspired)

* ✅ Cross-links between:
    - Instruments
    - Loops
    - Datasheets

* ✅ Validation and search by normalized tags

### Explicitly Out of Scope
#### ❌ Drawing editors

#### ❌ Full P&ID authoring

**Outcome**
SpecVerse integrates cleanly into I&C workflows while preserving scope discipline.

Together, these modules allow SpecVerse to function as a single source of truth for engineering definition, procurement, verification, and facility-scale documentation.


### 🏢 Facilities, Schedules & Operational Visibility

Together, the modules below allow SpecVerse to operate as a single source of truth for:

engineering definition, procurement, verification, and facility-scale documentation.

### 🏭 Equipment Schedules & Facilities Engineering

SpecVerse supports facility-scale documentation, not just one-off equipment datasheets.

#### **Capabilities**

* ✅ Equipment schedules for many similar assets

* ✅ Asset-first schedule rows (assets are the primary entity)

* ✅ Typed schedule columns:
    - string / number / boolean / date / enum

* ✅ Transactional replace-all saves for consistency and safety

* ✅ Strong validation guarantees:
    - One typed value per cell
    - No duplicate assets per schedule
    - No duplicate column keys (post-normalization)

* ✅ Schedule ↔ asset ↔ datasheet linkage

* ✅ Bulk editing with full audit safety

* ✅ Account, asset, and sheet ownership enforcement

#### **Standards Alignment**
    - ASHRAE Guideline 1.4
    - HVAC documentation and commissioning practices

**Outcome**

SpecVerse supports facility documentation, commissioning, and operations at scale, without sacrificing traceability or data integrity.

* 🔜 Phase 6.1 (Coming Soon): reusable schedule column templates by Discipline / Subtype.

### 📊 Dashboards, Analytics & Reports

Operational visibility is built into the platform, not bolted on.

#### **Dashboards**
- Datasheets by status
- Templates created over time
- Pending verifications
- Active users by role
- Inventory stock levels
- Estimation totals by project

#### **Analytics**
- Datasheet lifecycle duration
- Verification bottlenecks
- Monthly template usage
- Team performance overview
- Field completion trends

#### **Reports**
- Estimation cost breakdowns
- Inventory usage forecasts
- Category contribution analysis
- Rejected templates and datasheets over time
- Workflow streams for templates and datasheets
- Supplier comparison by item
- AI findings & quality signals (planned)
- Platform Capabilities
- Role-specific dashboards (Engineer, Manager, Admin, etc.)
- Interactive charts with modal data inspection

## 🚧 Near-Term Platform Expansion

The following initiatives extend SpecVerse’s production-ready foundation.
They are planned next steps — not experimental prototypes.

### 🧱 Labor Costing (Planned)

A dedicated module for structured labor estimation, aligned with EPC and industrial best practices.

#### Planned Capabilities

#### 1. Role-Based Labor Modeling
- Define labor roles such as:
  - Welder
  - Supervisor
  - Electrician
  - (extensible to other trades)

#### 2. Labor Allocation Targets
Labor can be allocated at multiple levels:
- Estimation package
- Equipment item
- Individual task or activity

#### 3. Productivity-Based Standards
- Support standardized productivity metrics, such as:
  - Weld-inches per day
  - Units per hour
- Enable reusable **Labor Standards** across projects

#### 4. Manual Overrides & Auditability
- Allow manual adjustments to labor quantities, rates, or hours
- All overrides are fully tracked with audit logs and change history

#### 5. Cost Derivation Logic
Labor cost is calculated using a transparent formula:

Total Labor Cost = Quantity × Hours × Rate


#### 6. Intelligent Labor Forecasting
- Suggest labor quantities automatically using predefined productivity standards
- Allow users to accept, modify, or override system-generated forecasts

### Integration Points

The Labor Costing module integrates with:
- Estimation exports (PDF / Excel)
- Dashboards and analytics
- Approval and governance workflows

### Outcome

SpecVerse evolves from **material-centric estimation** into **labor-aware project costing**, while preserving:
- Approval control
- Traceability
- Full auditability

This enables more accurate, defensible, and real-world project estimates suitable for industrial and EPC environments.

### 🔧 Upcoming Enhancements (Short Horizon)

**Phase 5.2 — Instrumentation Enhancements**
- Richer validation rules
- Improved filtering
- Loop visualization improvements

**Phase 6.1 — Reusable Schedule Templates**
- Discipline- and subtype-based column templates
- Self-Service Membership
- Join, leave, and switch accounts

**Superadmin Console**
- ✅ Platform admin governance (grant/revoke, audit-backed)
- Cross-account oversight
- System health monitoring
- Global audit visibility

---

### 🧠 AI-Ready Features *(Coming Soon)*

#### ⚖️ Datasheets

* Detect inconsistencies, missing values, and anomalies
* Suggest field values based on similar past sheets
* Generate summaries for managers and QA teams

#### 🛆 Inventory

* Predict restocking needs based on usage history
* Flag anomalies in consumption trends or update logs

#### 📊 Estimations

* Compare estimated vs. actual supplier costs
* Auto-detect cost drivers or high variance items
* Suggest cost-saving alternatives or vendors

#### 🧑‍💼 AI Assistant *(Planned)*

* Natural language search (e.g., “Show pumps with temp > 120°C”)
* Smart dashboards based on user role and behavior
* Auto-flag incomplete or high-risk datasheets

#### 🧩 Human-in-the-Loop Intelligence

AI-driven insights in SpecVerse are designed to operate in a
**propose → review → apply** workflow. Automated findings and suggestions
are always reviewable, auditable, and require explicit user approval
before changes are applied.

---

### 🧭 Strategic Roadmap (Long-Term Vision)

The initiatives below are not yet implemented.
They illustrate the directional intent of the platform and are designed to augment — not replace — engineering judgment.

### 🧠 AI-Assisted Engineering Intelligence (Vision)

AI in SpecVerse is positioned as decision support, never as an authority.

**Conceptual capabilities**
- Datasheet completeness and quality indicators
- Detection of anomalies and inconsistencies
- Suggested values based on:
    - historical projects
    - peer equipment
- Natural-language queries
    - (e.g., “show pumps operating above 120 °C”)
- Risk flags for QA, verification, and management review

**Principles**

All AI outputs are:
- reviewable
- auditable
- approval-gated

Human engineers remain the final authority.

### 🏭 SpecVerse PlantSync — CAD / EPC Integration (Vision)

A strategic integration layer between Autodesk Plant 3D and SpecVerse’s engineering core.

**Conceptual capabilities**

Ingest P&ID and Plant 3D databases into a unified SpecVerse model

Track additions, deletions, and modifications via staged sync logs

**Enforce:**
- tag uniqueness
- category constraints
- cross-table consistency

**Visual dashboards for:**
- sync coverage
- errors
- unrouted or orphaned objects

**Business value**

- Enables Plant-integrated datasheet management
**(a rare EPC differentiator)**
- Reduces manual re-entry and accelerates handover
- Opens future SaaS and licensing opportunities

**Positioning**

SpecVerse becomes the system-of-record layer between design tools and downstream engineering, procurement, and operations.

### 🧠 AI Foundation & Continuous Intelligence (Architecture Vision)

SpecVerse is architected to evolve into a telemetry-driven engineering platform.

**Foundation concepts**

Key system events emitted as structured telemetry:
- datasheet lifecycle changes
- inventory movements
- estimation revisions
- Background analysis services producing:
- findings
- trends
- forecasts

AI outputs persisted alongside audit logs for traceability

**Architectural considerations**

- Semantic indexing for cross-project intelligence
- Switchable LLM gateways (dev vs. production)
- Progressive evolution from heuristics → ML → managed services

This approach enables AI to be introduced incrementally and safely, without compromising engineering accountability.

---

### 🧪 Testing Strategy & Quality Assurance

SpecVerse emphasizes provable correctness over optimistic assumptions, with tests designed to enforce invariants across permissions, tenancy, transactions, and audit behavior. It is developed with a production-grade testing strategy spanning backend, frontend, domain logic, and security boundaries. Tests are organized by layer and responsibility, mirroring the platform’s architecture.

### 🔧 Backend API Tests

**Covers REST endpoints, authorization, and cross-entity rules:**
- Account & multi-tenant scoping
- Authentication, sessions, and invites
- Datasheets (templates, filled sheets, revisions, attachments)
- Equipment schedules & facilities (Phase 6)
- Estimations, inventory, and transactions
- Instrumentation, loops, and ratings
- Reports, exports, dashboards, and stats
- Audit logs, verification records, and approvals
- Permission enforcement and role gating
- Platform governance (platform admin grant/revoke, access enforcement, audit logging)

## ✔ Ensures correct HTTP status codes, error shapes, and RBAC enforcement
## ✔ Prevents cross-account data leakage
## ✔ Verifies replace-all transactional semantics and edge cases

## 🧠 Domain & Service Tests

**Validates core business rules independent of transport/UI:**
- Datasheet lifecycle guards (create → verify → approve → revise)
- Value validation, unit normalization, and conversions
- Revision diffing and audit consistency
- Schedule entry constraints (asset-first, unique keys, typed values)
- Verification and QA/QC workflows
- Export helpers (Excel/PDF structure, audit sections)
- Internationalization (i18n) and UOM helpers

## ✔ Ensures correctness of engineering logic, not just endpoints
## ✔ Guards invariants introduced in Phases 2–6

## 🧩 Repository & Middleware Tests

**Focuses on infrastructure correctness:**
- Repository query behavior
- Transaction handling (runInTransaction)
- Authorization middleware
- Permission resolution and role utilities
- Audit deduplication and linking

## ✔ Confirms data-layer safety and consistency
## ✔ Prevents silent partial writes and privilege escalation

## 🖥️ Frontend UI Tests

**Uses React Testing Library to validate real user flows:**
- Secure page gating (403 handling, redirects)
- Account switching and membership management
- Datasheet editors, builders, and comparisons
- Estimation dashboards and tables
- Equipment schedules editor (Phase 6)
- Invitations, verification pages, and admin settings
- Sidebar navigation and layout behavior

## ✔ Tests user-visible behavior, not implementation details
## ✔ Ensures frontend and backend authorization stay aligned

## 🧪 Utilities, Schemas & Guards

**Additional test coverage includes:**
- Zod schema validation
- Completeness scoring utilities
- Chart data preparation
- Export formatting helpers
- Unit conversion tables
- Permission maps and role utilities

## ✅ Quality Gates

**All changes are validated through:**
- npm run lint
- npm run type-check
- Scoped test runs during development
- Full test suite before merge
- Production builds (npm run build)
- This approach ensures SpecVerse remains:
- Safe by default
- Predictable under change
- Extensible across new phases and modules

---

### 🔐 Access Control, Roles & Permissions

SpecVerse implements a fine-grained, permission-driven RBAC system designed for real engineering, QA/QC, and operations workflows.

Access control is not hard-coded by role.
Instead, roles are collections of explicit permissions, enforced consistently across backend APIs and frontend UI.

Note: Roles apply only **within an account**.
They do not grant platform-level authority or ownership rights.

#### **Roles (Current)**

SpecVerse supports multiple operational roles aligned with real-world engineering organizations:

**Admin**
- Full system access within an account
- Manages users, roles, permissions, and account settings
- Can override approvals when explicitly permitted

**Manager**
- Oversight role across datasheets, estimations, schedules, and reports
- Typically holds approval, verification, and reporting permissions

**Engineer**
- Creates and edits datasheets, templates, instrumentation, ratings, and schedules
- Cannot approve or override without explicit permissions

**Estimator**
- Focused on estimation creation, editing, verification, and export
- No implicit access to datasheet approval or account management

**QA**
- Verification and inspection-oriented role
- Manages verification records, reviews compliance evidence, and audits changes

**Reviewer**
- Read-heavy role for structured review workflows
- May verify or comment without authoring privileges

**Maintenance**
- Inventory maintenance and operational updates
- Handles maintenance logs, asset condition updates, and related records

**Warehouse**
- Inventory-focused role
- Manages stock levels, transactions, and exports without access to engineering edits

**Viewer**
- Read-only access
- Can view and export permitted records but cannot modify data

Note:
The legacy Supervisor role is deprecated. Its responsibilities are now modeled explicitly through permissions and newer roles (Manager, QA, Reviewer).

### Platform Superadmin (Support / Ops)

SpecVerse includes a dedicated **Platform Superadmin** capability for operational support and system-level maintenance.

Platform Superadmins:

- Are **not tied to any account**
- Do **not inherit account roles or permissions**
- Cannot perform account-scoped actions (engineering, estimation, inventory, etc.)
- Operate only through platform-specific endpoints

Supported actions include:

- Listing active platform administrators
- Granting or revoking platform admin access
- Platform-level audit visibility for support and compliance
- System maintenance and recovery workflows (account reactivation, admin recovery)

Platform Superadmin access is enforced via:

- Dedicated middleware (`verifyTokenOnly` + `requirePlatformAdmin`)
- Database-backed authorization (`PlatformAdmins` table)
- Full audit logging for all grant/revoke actions

This separation ensures:
- Zero cross-tenant privilege leakage
- No accidental escalation into account-level authority
- Clear operational boundaries between support and engineering teams

---

### 🏛 Account Ownership Model (Critical Distinction)

SpecVerse separates **platform governance**, **account ownership**, and **account administration**
into three intentionally distinct authority layers.

This separation prevents accidental privilege escalation and mirrors best practices used by
enterprise SaaS platforms.

#### Platform Superadmin (Global Scope)

Platform Superadmins operate **above all accounts**.

They exist solely for:
- Platform maintenance and recovery
- Account reactivation
- Ownership recovery
- Administrative support operations

Platform Superadmins:
- ❌ Do not belong to any account
- ❌ Do not inherit account roles or permissions
- ❌ Cannot perform engineering, estimation, inventory, or datasheet actions
- ✅ Can grant or revoke platform admin access
- ✅ Can recover locked or orphaned accounts
- ✅ Are fully audit-logged

---

#### Account Owner (Per-Account, Ultimate Authority)

Each account has **exactly one Account Owner**.

The Account Owner represents the **business authority** for that account.

Account Owners:
- ✅ Are members of the account
- ✅ Always retain ownership even if role assignments change
- ✅ Can transfer ownership to another active account member
- ✅ Can deactivate or delete the account
- ✅ Can recover or reinstate account admins
- ❌ Cannot override platform governance

Ownership is **not a role** — it is an invariant property of the account.

---

#### Account Admin (Per-Account, Operational Authority)

Account Admins manage **day-to-day operations** within an account.

Admins:
- ✅ Manage users, roles, and permissions
- ✅ Create and approve templates and datasheets
- ✅ Manage inventory, estimations, and schedules
- ✅ Access audit logs and reports (when permitted)
- ❌ Cannot transfer account ownership
- ❌ Cannot delete or recover the account

Admins are powerful — but **always subordinate to the Account Owner**.

---

This model ensures:
- Clear escalation paths
- Zero cross-tenant privilege leakage
- Safe recovery workflows
- Predictable authority boundaries

### 🔐 Permission Model

#### Ownership vs Roles

Account ownership is evaluated **outside** the role-based permission system.

- An **Account Owner** may hold any role
- Ownership checks **always take precedence** over role permissions
- Ownership authority **cannot be revoked accidentally** through role changes

This guarantees a stable governance model even as roles evolve.

---

#### Permission Design Principles

Permissions are:
- **Explicit** (no hidden or implicit grants)
- **Composable** (roles are built from permissions)
- **Enforceable** (checked at runtime, not assumed)

They cover all major system actions and are designed for long-term extensibility.

---

#### Permission Domains

##### 📄 Datasheets
- `DATASHEET_CREATE`
- `DATASHEET_EDIT`
- `DATASHEET_VERIFY`
- `DATASHEET_APPROVE`
- `DATASHEET_REVISE`
- `DATASHEET_EXPORT`
- `DATASHEET_DELETE`

Notes and attachments are handled via **dedicated permissions**, separate from datasheet lifecycle actions.

---

##### 📑 Templates
- `TEMPLATE_CREATE`
- `TEMPLATE_EDIT`
- `TEMPLATE_VERIFY`
- `TEMPLATE_APPROVE`
- `TEMPLATE_REVISE`
- `TEMPLATE_EXPORT`

---

##### 📊 Estimations
- `ESTIMATION_CREATE`
- `ESTIMATION_EDIT`
- `ESTIMATION_VERIFY`
- `ESTIMATION_APPROVE`
- `ESTIMATION_EXPORT`

---

##### 📦 Inventory
- `INVENTORY_CREATE`
- `INVENTORY_EDIT`
- `INVENTORY_VIEW`

Inventory transactions, maintenance, and exports are governed by **separate permission sets**.

---

##### 🏭 Facilities & Schedules
- `SCHEDULES_CREATE`
- `SCHEDULES_EDIT`
- `SCHEDULES_VIEW`

---

##### 🎛 Instrumentation & Ratings
- Instrumentation and loop management permissions
- Ratings and nameplate permissions (create / edit / view)

---

##### ✅ Verification
- `VERIFICATION_CREATE`
- `VERIFICATION_EDIT`
- `VERIFICATION_VIEW`

---

##### 🛡 Platform & Governance
- Role and permission management
- Account settings management
- Audit log access
- Export job visibility and cleanup
- Explicit system override permissions

---

#### Enforcement Model

Permissions are enforced **end-to-end**, with no reliance on UI-only checks.

##### Backend Enforcement
- Token verification with permission guards on every protected route
- Strict account-scoped data isolation
- No implicit privilege escalation

##### Frontend Enforcement
- Route-level access gating
- Conditional UI rendering
- Graceful handling of `403 Forbidden` responses

---

#### Architectural Outcomes

This permission architecture enables:
- Safe delegation of responsibilities
- Clear separation between engineering, QA, estimation, and operations
- Future expansion without schema or authorization rewrites

---

### 📟 Audit, Traceability & System Logs

SpecVerse implements **platform-wide audit and change tracking** across all core modules — not just datasheets.

Auditability is treated as a **first-class system concern**, enforced consistently at:
- API boundaries
- Service and transaction layers
- Export pipelines (PDF / Excel)
- Background jobs and platform operations

---

#### 🔍 What Is Audited

#### 📄 Datasheets & Templates
- Full lifecycle actions:
  - create
  - edit
  - verify
  - approve
  - reject
- Field-level change logs (before / after values)
- Revision metadata:
  - revision number
  - revision date
  - engineering revision
- Export actions (PDF / Excel), including:
  - unit system
  - language selection
- Linked verification records and evidence attachments
- Canonical attachment add / delete with deduplication guarantees

---

#### 📊 Estimations
- Estimation creation, updates, and history access
- Export jobs (sync and async) with full status transitions
- Cross-tenant access protection (explicitly test-verified)

---

#### 📦 Inventory
- Inventory item lifecycle actions
- Stock transactions:
  - inbound
  - outbound
  - adjustments
- Maintenance logs:
  - repairs
  - inspections
  - notes
- Global inventory audit and maintenance views
- CSV exports with filter-aware audit coverage

---

#### 🏭 Schedules & Assets
- Equipment schedules and asset records
- Schedule edits and structural changes
- Schedule and asset exports
- Consistent audit linkage back to owning entities

---

#### 👥 Accounts, Users & Membership
- Account member invites and accept / decline flows
- Role changes:
  - assignment
  - activation / deactivation
  - reactivation
- Self-service and admin-initiated membership changes
- Explicit handling of:
  - anonymous actions
  - authenticated actions

---

#### 📤 Exports & Background Jobs
- Export job lifecycle:
  - creation
  - execution
  - retry
  - cancellation
  - expiry
- Secure download tokens with expiration handling
- Cleanup jobs and failed export recovery paths

---

#### 🛡 Platform Governance
- Platform admin grant and revoke actions
- Actor-aware audit entries (`performedBy`)
- Immutable audit trail for support and operations
- Explicit exclusion of account context for platform-level actions

---

### 🧾 Audit Log Characteristics

Audit logs follow a **unified and consistent model** across all modules.

Key characteristics include:
- Unified audit schema (consistent IDs and shapes)
- Entity-aware linking (audit entries resolve to the correct UI page)
- Deduplicated logging:
  - guaranteed single audit per logical action
- Cross-tenant safe:
  - `401` / `404` enforcement
  - covered by tests
- Export-embedded:
  - audit and change logs included in PDF / Excel outputs
- Human-readable and machine-verifiable

Audit and change logs are exposed through:
- Dedicated backend APIs
- Admin UI audit views
- Embedded export sections (PDF / Excel)
- Test-verified schemas and pagination guarantees

---

### 🧪 Test Coverage & Guarantees

Audit behavior is **explicitly tested**, including:
- Required audit emission per action
- Absence of audits when intentionally excluded
- ID stability and uniqueness
- Pagination and filtering correctness
- Cross-account isolation
- Regression protection:
  - routing
  - deduplication
  - exports

This makes audit logging **provable**, not aspirational.

---

## 🌍 Internationalization

* ✅ UI translation via `i18next` and `translations.ts`
* ✅ Field/subsheet translation via DB-stored records
* ✅ 7 supported languages: `eng`, `fr`, `de`, `ru`, `zh`, `ar`, `es`
* ✅ Multilingual export to PDF/Excel with correct units

---

## 📦 Tech Stack

SpecVerse is built as a production-grade, full-stack engineering SaaS with strong emphasis on data integrity, auditability, and long-term extensibility.

## 🧠 Backend

Node.js + Express (TypeScript) — layered controller → service → repository architecture

SQL Server — normalized, account-scoped relational model

Strict authorization — JWT + session middleware + permission checks on every route

Multi-tenant by design — AccountID enforced at query, service, and trigger level

Replace-all transactional APIs — deterministic writes with rollback guarantees

Canonical data rules — enforced via schema validation + DB triggers

## 🔐 Authentication, Security & Multi-Tenancy

JWT-based authentication

Active account sessions (multi-account switching)

Role-based access control (RBAC) with fine-grained permissions

Backend-enforced authorization (verifyToken, requirePermission)

Frontend enforcement (route gating + UI affordances)

Cross-tenant isolation verified by tests

## 🌐 Frontend

Next.js (App Router) — server-first rendering with client interactivity where required

TypeScript (strict) — end-to-end type safety

React + Tailwind CSS — componentized UI with utility-first styling

react-i18next — runtime multilingual support (DB-driven translations)

Recharts — dashboards, analytics, and reports

Role-aware routing — SecurePage, permission gating, 403 handling

Tested UI flows — datasheets, estimations, schedules, inventory, accounts

## 📄 PDF & Excel Exports

Puppeteer — pixel-accurate PDF exports (datasheets, estimations, schedules)

ExcelJS — structured, multi-sheet Excel exports with audit sections

Async export jobs — background processing with status, retry, expiry

Embedded audit trails — exports include change logs, approvals, and metadata

## 🗄️ Storage

Database-backed metadata for all core entities

File attachments with canonical reference model (deduplication-safe)

Local public storage for dev/demo

Cloud-ready design (S3/Azure Blob compatible)

## 🧪 Testing & Quality

Extensive automated test suite (API, service, domain, middleware, UI)

Authorization & account-scope tests for every major module

Replace-all and transactional behavior verified

Audit and export correctness tested

Type-check + lint enforced

SpecVerse favors provable correctness over optimistic assumptions.

## 🚀 Deployment & Environments

Frontend: Vercel

Backend: Render or Azure App Services

Database: SQL Server (Azure-ready)

Environment isolation: dev / demo / production-ready

CI-friendly setup with deterministic builds

## 🖨️ PDF Export (Puppeteer) — Local Dev & CI Notes

SpecVerse uses Puppeteer for PDF generation.

For local development or CI runners:

A Chromium / Chrome binary must be available

Environment variables can be configured to point to the executable

Works in local dev, Render, and Azure environments

This setup ensures consistent, production-quality PDF output across environments.

---

## 📸 Screenshots

*(see existing section above)*

---

#### 📄 Local Setup & Development

#### Clone the repository
git clone https://github.com/jmjabayon928/specverse.git
cd specverse

#### Install dependencies
npm install

#### Start development servers
npm run dev-backend
npm run dev

**Environment configuration**

SpecVerse uses separate environment files for clarity and safety:

**Frontend**
- **.env.local — Next.js frontend configuration**

**Backend**
- **.env — local development**

## .env.production — deployment/runtime configuration

Environment variables cover:

Database connections

Authentication & session settings

Export jobs (PDF / Excel)

Dev-only utilities (disabled in production)

⚠️ Dev-only utilities are explicitly guarded and cannot run in production.

## 🧪 Demo & Recruiter Reset (Local / Dev Only)

For local demos or recruiter walkthroughs, SpecVerse provides dev-only utilities to:

Seed an admin account

Reset the admin password safely

Start from a known clean state

These endpoints are hard-disabled in production builds.

See docs/demo-reset.md
 for:

Required environment flags (DEV_ADMIN_UTILS=1, NODE_ENV !== production)

cURL and PowerShell examples

Recommended demo workflow

## 🧪 Testing & Quality Gates

SpecVerse uses a layered testing strategy covering backend, domain logic, and UI.

Before opening a PR, run locally:

npm ci
npm run lint
npm run type-check
npm test -- --runInBand --no-cache


**The test suite includes:**
- API tests (auth, datasheets, schedules, inventory, estimations, audits)
- Service and domain logic tests
- Schema validation tests
- Permission and authorization guards
- UI tests for critical workflows
- CI
- CI runs on pushes to main, staging, and release/**
- All linting, type-checking, and tests must pass before merge

---

## 👨‍💼 Author

### **Jeff Martin Abayon**

### 📍 Calgary, Canada

### 📧 [jmjabayon@gmail.com](mailto:jmjabayon@gmail.com)

### [LinkedIn Profile](https://www.linkedin.com/in/jeff-martin-abayon-calgary/)
