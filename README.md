# 📘 SpecVerse - Engineering Data & Estimation Platform

SpecVerse is an all-in-one engineering datasheet and project estimation system tailored for EPC and industrial projects. It supports datasheet creation, equipment specification, multi-language exports, cost estimation, procurement tracking, and more.

---

## 🌟 Key Innovation

SpecVerse was designed to solve a real-world engineering bottleneck: **every time a new datasheet format was needed, developers had to build a new app or database to support it.**

With SpecVerse’s dynamic template engine:

* Subsheet structures and templates are fully configurable
* No code or schema changes are needed to support new datasheets
* Engineers or admins can define new datasheets themselves

This enables **true no-code datasheet configuration** — a huge time and cost saver for EPC and industrial firms.

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

---

## 👨‍💼 Author

**Jeff Martin Abayon**
📍 Calgary, Canada
📧 [jmjabayon@gmail.com](mailto:jmjabayon@gmail.com)
[LinkedIn Profile](https://www.linkedin.com/in/jeff-martin-abayon-calgary/)
