# 📘 SpecVerse - Engineering Data & Estimation Platform

[![CI (main)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml)
[![CI (staging)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg?branch=staging)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml?branch=staging)
[![CI (release/v0.5)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml/badge.svg?branch=release/v0.5)](https://github.com/jmjabayon928/specverse/actions/workflows/ci.yml?branch=release/v0.5)

SpecVerse is an all-in-one engineering datasheet and project estimation system tailored for EPC and industrial projects. It supports datasheet creation, equipment specification, multi-language exports, cost estimation, procurement tracking, and more.

---

## 🌟 Key Innovation

SpecVerse was designed to solve a real-world engineering bottleneck: **every time a new datasheet format was needed, developers had to build a new app or database to support it.**

With SpecVerse’s dynamic template engine:

* Subsheet structures and templates are fully configurable
* No code or schema changes are needed to support new datasheets
* Engineers or admins can define new datasheets themselves

This enables **true no-code datasheet configuration** — a huge time and cost saver for EPC and industrial firms.

## Phase 1 – Multi-discipline datasheets

SpecVerse now supports multiple engineering disciplines end-to-end using the same template-driven datasheet engine. Discipline and subtype are stored on templates and filled datasheets, surfaced consistently across list and detail views with filters and badges.

Phase 1 introduces seeded disciplines (Piping and Instrumentation) and a Pressure Transmitter subtype, with an optional seed script that creates a realistic Instrumentation datasheet template for demonstration. This phase intentionally avoids schema redesign or engine changes, proving that the existing universal datasheet model supports cross-discipline use without specialization.

> **Status:** Implemented and in active use.  
> This phase validates that SpecVerse’s universal datasheet engine supports cross-discipline expansion without schema redesign.


---

## ✅ Implemented Platform Phases

SpecVerse has already implemented the following roadmap phases in production-ready form:

### Phase 0 — Core Datasheet Platform (Complete)
- Template-based datasheets with subsheets and typed fields
- Filled vs template datasheets
- Unit validation and multilingual support
- Approval workflows
- Attachments, notes, and exports
- Estimation and inventory linkage

### Phase 1 — Multi-Discipline Datasheets (Complete)
- Discipline-agnostic datasheet engine
- Discipline and subtype stored on templates and filled sheets
- Cross-discipline support without schema specialization
- Seeded examples for Piping and Instrumentation

### Phase 2 — Requirement vs Offered vs As-Built Modeling (Complete)
- Datasheet fields support multiple value sources
- Clear separation of purchaser requirements, vendor-offered values, and verified/as-built values
- Variance awareness for compliance and procurement workflows

### Phase 2.5 — Multi-Account / Multi-Tenant Architecture (Complete)
- Account-scoped data model across all core entities
- Account-aware authorization and query enforcement
- Safe isolation of datasheets, estimations, inventory, and verification records

### Phase 3 — Verification & Inspection Records (Complete)
- First-class Verification Records (QA/QC objects)
- Standard-aware certification and inspection tracking
- Attachments linked to assets and datasheets
- Full auditability and traceability

By completing Phases 0–3, SpecVerse already operates as:
- A structured system of record for engineering data
- A procurement-aware datasheet platform
- A QA/QC and verification traceability system
- A multi-tenant, production-grade SaaS architecture

Later phases extend these foundations rather than replacing them.

---

## 🧩 Core Modules

### 📄 Datasheets

* ✅ Create/edit datasheet templates (with subsheets and information templates)
* ✅ Fill datasheets with actual project/equipment data
* ✅ Inline editing with unit validation (SI/USC support)
* ✅ Clone datasheets and track revisions
* ✅ Multi-language support via database + i18next
* ✅ Export to PDF and Excel (translated + UOM converted; includes Audit Trail section)
* ✅ Approval workflow: Draft → Rejected (if needed) → Modified → Verified → Approved
* ✅ Notes & collaboration: per-sheet threaded notes; template notes auto-copied to new filled sheets *(new)*
* ✅ Attachments: attach files to templates/datasheets; filled sheets **reference** template attachments to save storage *(new)*
* ✅ Full audit trail & change logs: template structure changes + field value changes; shown in viewers (newest first, “Show more”) and included in exports (up to 50 entries) *(new)*
* ✅ Dashboard + AI-ready metadata (new)

### 📊 Estimations

* ✅ Create project estimations with packages and items
* ✅ Add and compare multiple supplier quotes
* ✅ Auto-compute totals and select winning quotes
* ✅ Filter by status, client, or project
* ✅ Export estimation to:

  * Full Report PDF/Excel
  * Summary PDF/Excel
  * Procurement sheets (per package or full)
* ✅ Approval workflow: Draft → Verified → Approved
* ✅ Dashboard + estimation analytics (cost breakdowns, supplier comparison)

### 🛆 Inventory

* ✅ Track inventory per item and warehouse
* ✅ Edit and update quantity, logs, and metadata
* ✅ View stock levels and item linkage to datasheets
* ✅ Export inventory and usage trends (Excel)
* ✅ Inventory analytics: usage forecast, category breakdown
* ✅ Role-based access for maintenance, restocking

---

## 📊 Dashboards, Analytics & Reports

* ✅ Role-specific dashboards for Engineer, Supervisor, Admin
* ✅ Multi-series Recharts visualizations
  
* ✅ Dashboard:
  * Datasheets by Status
  * Templates Created Over Time
  * Pending Verifications
  * Active Users by Role
  * Inventory Stock Levels
  * Estimation Totals by Project

* ✅ Analytics:
  * Datasheet Lifecycle Duration
  * Verification Bottlenecks
  * Monthly Template Usage
  * Team Performance Overview
  * Field Completion Trends

* ✅ Reports:
  * Estimation Cost Breakdown by Project
  * Inventory Usage Forecast
  * Inventory Category Contribution
  * Rejected Templates Over Time
  * Rejected Datasheets Over Time
  * Workflow Stream for Templates and Datasheets
  * Supplier Comparison by Item
  * AI Findings & Quality Signals (planned; surfaced alongside audit logs)

* ✅ View data behind charts via modal tables

---

## 🧠 AI-Ready Features *(Coming Soon)*

### ⚖️ Datasheets

* Detect inconsistencies, missing values, and anomalies
* Suggest field values based on similar past sheets
* Generate summaries for managers and QA teams

### 🛆 Inventory

* Predict restocking needs based on usage history
* Flag anomalies in consumption trends or update logs

### 📊 Estimations

* Compare estimated vs. actual supplier costs
* Auto-detect cost drivers or high variance items
* Suggest cost-saving alternatives or vendors

### 🧑‍💼 AI Assistant *(Planned)*

* Natural language search (e.g., “Show pumps with temp > 120°C”)
* Smart dashboards based on user role and behavior
* Auto-flag incomplete or high-risk datasheets

### 🧩 Human-in-the-Loop Intelligence

AI-driven insights in SpecVerse are designed to operate in a
**propose → review → apply** workflow. Automated findings and suggestions
are always reviewable, auditable, and require explicit user approval
before changes are applied.

---

## 🧪 In Progress / Experimental Features

* Gantt-style timeline view for datasheets and estimations
* Real-time alerts for pending approvals
* Procurement request generator and approval workflow
* Auto-tagging datasheets by system/discipline
* Full version control for datasheets and estimations
* Data quality score per sheet (completeness, consistency)

---

## 📘 Planned Modules

### 🧱 Labor Costing (Upcoming)

A new module to support structured labor cost estimation per role, package, or task. Based on industrial and EPC best practices:

* Role-based labor breakdowns (e.g., Welder, Supervisor, Electrician)
* Per-package or per-item labor allocation
* Reference-based productivity standards (e.g., weld-inches/day)
* Optional manual overrides with audit logs
* Derived cost calculation: `Qty × Hours × Rate`
* Smart forecasting using Labor Standards (e.g., manhour tables)
* Integration with Estimation exports and dashboards

This module will support both manual entry and auto-suggestion based on scope and productivity metrics, with full reporting and approval support.

---

## 🧭 Strategic Roadmap (Vision)

This section outlines **long-term platform directions** under consideration for SpecVerse.  
The capabilities described here are **not yet implemented** and are presented to illustrate the architectural direction and future potential of the platform.
These initiatives are intended to complement—not replace—human engineering judgment and approval workflows.

The phases below describe planned and conceptual capabilities.
Phases beyond Phase 3 are **not yet implemented** and are included to illustrate the platform’s architectural direction.

## Phase 4 – Ratings & Nameplate Modeling

### Motivation
Ratings are safety-critical and operational truth.

### Implementation
- Structured ratings blocks (locked after approval)
- Nameplate data capture
- Installation and protection references

### Standards Alignment
- NEMA MG 1
- IEC motor standards
- Pressure vessel nameplate practices

### Outcome
SpecVerse supports **installation, commissioning, and O&M accuracy**.

---

## Phase 5 – Instrumentation & Loop Awareness (Lightweight)

### Scope (Intentionally Limited)
- Instrument index
- Loop IDs
- Tag formatting rules (ISA-5.1 inspired)
- Cross-links between instruments, loops, and datasheets

### What is Explicitly Out of Scope
- Drawing editors
- Full P&ID systems

### Outcome
SpecVerse integrates into I&C workflows **without exploding scope**.

---

## Phase 6 – Equipment Schedules & Facilities Engineering

### Motivation
Buildings and facilities rely on **schedules and systems manuals**, not one-off datasheets.

### Features
- Schedule views (many similar assets)
- Bulk editing
- Location / space / system metadata
- Links to detailed datasheets

### Standards Alignment
- ASHRAE Guideline 1.4
- HVAC documentation practices

### Outcome
SpecVerse supports **facility-scale documentation and commissioning**.

---

## Phase 7 – AI-Assisted Intelligence (Optional / Incremental)

### User-Visible Capabilities
- Datasheet completeness scoring and quality indicators
- Detection of anomalies and inconsistencies
- Suggested values based on historical and peer data
- Natural-language queries (e.g., “show pumps >120 °C”)
- Risk flags and attention markers for QA and managers

### Positioning
AI augments **engineering judgment** — it does not replace it.
All suggestions are reviewable, auditable, and require human approval.

---

### 🏭 SpecVerse PlantSync — EPC CAD Integration *(Vision)*

SpecVerse PlantSync is a strategic integration layer designed to bridge **Autodesk Plant 3D** with SpecVerse’s datasheet, estimation, and inventory core.

**Conceptual capabilities include:**
- Ingesting P&ID and piping databases from Plant 3D into a unified SpecVerse model
- Tracking additions, deletions, and modifications via staging and synchronization logs
- Enforcing tag uniqueness, category constraints, and cross-table consistency
- Surfacing coverage gaps, sync errors, and unrouted objects via visual dashboards

**Business value:**
- Enables Plant3D-integrated datasheet management — a rare, high-value EPC differentiator
- Reduces manual data entry and accelerates engineering handover
- Opens future licensing and SaaS revenue opportunities for CAD-integrated workflows

This direction positions SpecVerse as a **system-of-record layer between design tools and downstream engineering, procurement, and estimation processes**.

---

### 🧠 AI Foundation & Continuous Intelligence *(Architecture Vision)*

SpecVerse is designed to evolve into a **telemetry-driven, self-learning engineering platform** that continuously monitors data quality and operational signals.

**Foundation concepts:**
- Key system events (datasheet lifecycle, inventory movements, estimation changes) emitted into structured telemetry stores
- Background analysis services producing findings and forecasts
- AI outputs persisted alongside audit logs for traceability and review

**Architectural considerations:**
- Semantic indexing and embeddings for cross-project intelligence
- Switchable LLM gateways for development vs. production
- Progressive evolution from lightweight analysis to managed ML services

This foundation enables AI features to be introduced **incrementally, safely, and auditably**, without compromising engineering accountability.

---

## 🛠️ Test Data Simulation (For Demos)

To populate dashboards and reports for testing or demos:

* ✅ Clone templates into filled datasheets with realistic values
* ✅ Randomly assign users, dates, rejection comments
* ✅ Simulate estimation items with multiple supplier quotes
* ✅ Populate inventory stock levels per category or warehouse

---

## 🔐 User Access & Permissions

### Roles

* **Admin** – Full access, manages users, overrides approvals
* **Supervisor** – Verifies/approves datasheets and estimations
* **Engineer** – Creates/edits records but cannot approve
* **Viewer** – Read-only, can view and export

### Fine-grained Permissions

Includes:

* `TEMPLATE_CREATE`, `DATASHEET_APPROVE`, `INVENTORY_EDIT`, etc.
* Enforced on both backend and frontend using `SecurePage`

---

## 📟 Audit & Logging

* ✅ `UserLogs` table for all major actions (VIEW, CREATE, UPDATE, EXPORT, DELETE)
* ✅ `InformationChangeLogs` for field-level updates
* ✅ Approval and verification history per sheet and estimation
* ✅ Verification records with linked evidence attachments
* Planned: AI-generated findings and recommendations recorded alongside
  human actions for traceability and review

These verification and audit capabilities correspond to **Phase 3 of the SpecVerse roadmap**, establishing SpecVerse as a QA/QC and compliance backbone rather than a passive document repository.

---

## 🌍 Internationalization

* ✅ UI translation via `i18next` and `translations.ts`
* ✅ Field/subsheet translation via DB-stored records
* ✅ 7 supported languages: `eng`, `fr`, `de`, `ru`, `zh`, `ar`, `es`
* ✅ Multilingual export to PDF/Excel with correct units

---

## 📦 Tech Stack

* **Frontend:** Next.js 14+, TailwindCSS, TypeScript, react-i18next, Recharts, TailAdmin
* **Backend:** Express.js, Node.js, SQL Server
* **PDF/Excel Export:** `puppeteer`, `exceljs`
* **Authentication:** JWT (with session middleware and SecurePage enforcement)
* **Hosting:** Vercel (frontend), Render or Azure (backend)
* **Storage:** Local public folder for logos, avatars (S3-ready)
* **CI/CD:** Render or GitHub Actions for automated deployment *(in progress)*

### 🖨️ PDF export (Puppeteer) — local dev / CI prerequisites

SpecVerse generates datasheet PDFs using **Puppeteer**. Your machine/CI runner must have a usable Chrome/Chromium binary available.

**Option A — Install Google Chrome (recommended for local dev)**

- Install Chrome normally (Windows/macOS/Linux).
- The PDF generator includes a local-dev fallback that tries to launch **system Chrome** via Puppeteer’s `channel: 'chrome'` when Puppeteer-managed browser binaries are missing.

**Option B — Install Puppeteer-managed browser binaries (recommended for CI)**

Run this once after `npm install`:

```powershell
npx puppeteer browsers install chrome
```

You can also inspect what Puppeteer sees:

```powershell
npx puppeteer browsers list
```

**Quick “doctor” check (verify PDF export prerequisites)**

This launches a headless browser and immediately closes it:

```powershell
node -e "require('puppeteer').launch({ headless: true }).then(b => b.close()).then(() => console.log('✅ Puppeteer OK')).catch(e => { console.error('⛔ Puppeteer failed:', e && e.message ? e.message : e); process.exit(1) })"
```

**Troubleshooting**

- If you see: `Error: Could not find Chrome (ver. ...)`  
  Install Chrome (Option A) or run `npx puppeteer browsers install chrome` (Option B), then retry the export.

---

## ✅ Testing & Quality Assurance

SpecVerse includes a growing suite of automated tests to ensure code quality and prevent regressions.

### 🧢 UI & Component Tests

* Built using **Jest** and **React Testing Library**
* Tests core UI components including login form, dashboards, and charts
* Mocks API requests and DOM features like `ResizeObserver`
* Ensures proper rendering and interaction

### ⚙️ Backend API Tests *(in progress)*

* Designed with **Jest** and **Supertest**
* Targets key API routes like estimation, datasheets, and inventory
* Validates response structure, authorization, and CRUD logic

### ✅ Test Setup

* Configured via `jest.config.ts` and `jest.setup.ts`
* Supports TypeScript and custom path aliases (`@/`)
* Mocks assets (SVG, CSS) to prevent crashes during render
* Includes a reusable `<SecurePage />` wrapper test

### 📂 Test Locations

* UI tests: `tests/ui/`
* Backend tests: `tests/api/`
* Shared mocks: `__mocks__/`
* Setup: `jest.config.ts`, `jest.setup.ts`

### ▶️ Running Tests

```bash
# Run all tests
npm test

# Watch test files for changes
yarn test:watch

# Run a specific test file
npx jest tests/ui/loginForm.test.tsx
```

---

## 📸 Screenshots

*(see existing section above)*

---

## 📄 Setup Instructions

```bash
# Clone this repo
git clone https://github.com/jmjabayon928/specverse.git
cd specverse

# Install dependencies
npm install

# Start development servers
npm run dev-backend
npm run dev

# Setup environment variables
.env.local for frontend
.env for backend
.env.production for deployment
```

### Demo reset (local / dev only)

For local development or recruiter demos, you can seed an admin user and reset the admin password via dev-only API endpoints. **These are disabled in production.**

See **[docs/demo-reset.md](docs/demo-reset.md)** for:

- Required env flags (`DEV_ADMIN_UTILS=1`, `NODE_ENV` not production)
- cURL and PowerShell examples for seed-admin and reset-admin-password
- Recommended demo workflow

---

## Contributing

Before opening a PR, run locally:

* `npm ci`
* `npm run lint`
* `npm run type-check`
* `npm test -- --runInBand --no-cache`

CI must pass for PRs to be merged. The CI workflow runs on pushes to `main`, `staging`, and `release/**`.

---

## 👨‍💼 Author

**Jeff Martin Abayon**
📍 Calgary, Canada
📧 [jmjabayon@gmail.com](mailto:jmjabayon@gmail.com)
[LinkedIn Profile](https://www.linkedin.com/in/jeff-martin-abayon-calgary/)
