# 📘 SpecVerse - Engineering Data & Estimation Platform

SpecVerse is an all-in-one engineering datasheet and project estimation system tailored for EPC and industrial projects. It supports datasheet creation, equipment specification, multi-language exports, cost estimation, procurement tracking, and more.

---

## 🌟 Key Innovation

SpecVerse was designed to solve a real-world engineering bottleneck: **every time a new datasheet format was needed, developers had to build a new app or database to support it.**

With SpecVerse’s dynamic template engine:
- Subsheet structures and templates are fully configurable
- No code or schema changes are needed to support new datasheets
- Engineers or admins can define new datasheets themselves

This enables **true no-code datasheet configuration** — a huge time and cost saver for EPC and industrial firms.

---

## 🧩 Core Modules

### 📄 Datasheets
- ✅ Create/edit datasheet templates (with subsheets and info templates)
- ✅ Fill datasheets with actual project/equipment data
- ✅ Inline editing with unit validation (SI/USC support)
- ✅ Clone datasheets and track revisions
- ✅ Multi-language support via react-i18next
- ✅ Export to PDF and Excel (formatted)
- ✅ Approval workflow (Draft → Verified → Approved) *(Coming soon)*

### 📊 Estimations
- ✅ Create project estimations
- ✅ Add multiple packages, items, and supplier quotes
- ✅ Select winning quotes (auto-compute totals)
- ✅ Filter by status, client, project (multi-select dropdowns)
- ✅ Paginated dashboard with search
- ✅ Export estimation to:
  - Full Report PDF/Excel
  - Summary PDF/Excel
  - Procurement sheets per package or full
- ✅ Approval workflow *(Planned)*
- ✅ KPI Dashboard *(Planned)*

### 📦 Inventory
- ✅ Link items to datasheet variants
- ✅ Track quantity per warehouse
- ✅ Edit and update inventory records
- ✅ Export inventory *(Planned)*
- ✅ Inventory approval workflow *(Planned)*

---

## 🔐 User Access & Permissions

### Roles
- **Admin** – Full access, manages users, overrides approvals
- **Supervisor** – Verifies/approves datasheets and estimations
- **Engineer** – Creates/edits records but cannot approve
- **Viewer** – Read-only, can view and export

### Fine-grained Permissions
Includes:
- `can_create_template`, `can_approve_datasheet`, `can_manage_inventory`, etc.
- Enforced at route-level and UI-level

---

## 🧾 Audit & Logging
- ✅ `UserLogs` table records:
  - Actions: VIEW, CREATE, UPDATE, DELETE, EXPORT
  - Timestamp, UserID, Module, RecordID, Description
- ✅ Field-level change history for datasheets (`InformationChangeLogs`)

---

## 🌍 Internationalization
- ✅ react-i18next setup
- ✅ Supports dynamic UI translation
- ✅ Multi-language datasheet export (12+ supported)

---

## 🚧 Upcoming Features
- [ ] Approval workflows for datasheets and estimations
- [ ] Dashboard and KPI charts (quote coverage, estimation trends)
- [ ] Supplier-specific procurement views
- [ ] Version control for datasheets and estimations
- [ ] Inventory export and restocking logs
- [ ] Real-time notifications for approvals/changes

---

## 📦 Tech Stack

- **Frontend:** Next.js 14+, TailwindCSS, TypeScript, react-select, react-i18next
- **Backend:** Express.js, Node.js, SQL Server
- **PDF/Excel Export:** `html-pdf-node`, `exceljs`
- **Authentication (Planned):** JWT or NextAuth
- **Storage:** Local public folder for user avatars (S3-compatible optional)

---

## 🛠️ Setup Instructions

1. Clone this repo:
   ```bash
   git clone https://github.com/jmjabayon928/specverse.git
   cd specverse
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development servers:
   - Backend: `npm run dev-backend`
   - Frontend: `npm run dev`

4. Setup environment variables in `.env.local` and `.env`

---

## 👨‍💻 Author

Jeff Martin Abayon  
📍 Calgary, Canada  
📧 jmjabayon928@gmail.com

---