# Phase 1 Demo & Verification Plan (Portfolio-Ready)

Repeatable demo flow and checklists that prove SpecVerse multi-discipline capability. No new implementation—use existing Phase 1 features only.

---

## 1. 5-minute demo script

**Setup:** App running, seed SQL and seed script already run (see §3). Logged in as a user with datasheet access.

| Step | Action | Say |
|------|--------|-----|
| **1** | Open **Templates** (`/datasheets/templates`). | *"SpecVerse supports multiple engineering disciplines. Here’s the template library."* |
| **2** | Point to **Filter by Discipline** dropdown. Select **Instrumentation**. | *"We can filter by discipline. I’ll show Instrumentation."* |
| **3** | Point to the **Instrument Datasheet – Pressure Transmitter** row and its **Instrumentation** badge. | *"This is an instrumentation template—pressure transmitter—with a discipline badge. Templates are tagged by discipline and subtype."* |
| **4** | Click the template name to open detail. Point to the header line **Instrumentation · Pressure Transmitter**. | *"On the template detail, discipline and subtype are shown in the header."* |
| **5** | Use the app flow to **create a filled sheet** from this template (e.g. “New Filled Sheet” and pick this template, or template actions → Create Filled). | *"I’ll create a filled datasheet from this template."* |
| **6** | After creation, go to **Filled** list (`/datasheets/filled`). | *"Now the filled datasheets list."* |
| **7** | Set **Filter by Discipline** → **Instrumentation**. | *"Same discipline filter here. Filled sheets inherit discipline from the template."* |
| **8** | Point to the new filled sheet and its **Instrumentation** badge. Click to open. | *"The new sheet appears under Instrumentation. Opening it…"* |
| **9** | Point to the detail header: **Instrumentation · Pressure Transmitter**. | *"The filled sheet header shows the same discipline and subtype. End-to-end: template → creation → list filter → detail. Multi-discipline is visible throughout."* |

**Outro (if time):** *"We can add more disciplines and subtypes via seed data; the UI and backend already support them."*

---

## 2. Screenshot checklist

Capture these for portfolio or evidence. Each line = one screenshot; **bold** = must be visible in the image.

| # | Page / Route | What must be visible |
|---|----------------|----------------------|
| 1 | **Templates list** (`/datasheets/templates`) | **Filter by Discipline** dropdown; **Filter by Subtype** dropdown; table with **Discipline** column and at least one **badge** (e.g. Instrumentation or Unspecified). |
| 2 | **Templates list – filtered** | **Filter by Discipline** = Instrumentation; **Instrument Datasheet – Pressure Transmitter** row; **Instrumentation** badge in Discipline column. |
| 3 | **Template detail** (`/datasheets/templates/[id]`) | Template name; **Instrumentation · Pressure Transmitter** (or equivalent) in the header/subtitle area; subsheet names (e.g. Process Data, Electrical/Signal). |
| 4 | **Filled list** (`/datasheets/filled`) | **Filter by Discipline** (and Subtype); table with **Discipline** column and badges. |
| 5 | **Filled list – filtered** | **Filter by Discipline** = Instrumentation; at least one filled sheet row with **Instrumentation** badge. |
| 6 | **Filled sheet detail** (`/datasheets/filled/[id]`) | Sheet title; **Instrumentation · Pressure Transmitter** (or equivalent) in the header; content/subsections. |

**Tip:** Name files e.g. `01-templates-list.png`, `02-templates-filter-instrumentation.png`, … for easy ordering.

---

## 3. Verification checklist

Use this to confirm environment and data before the demo or for CI/manual QA.

### 3.1 Prerequisites

- [ ] DB has Disciplines and DatasheetSubtypes tables (run `docs/phase1/verify-discipline-schema.sql` if unsure).
- [ ] At least one row each: Categories, Users, Clients, Projects, Areas, Manufacturers, Suppliers.

### 3.2 Seed SQL

- [ ] Run `docs/phase1/chunk5-seeds.sql` (no errors).
- [ ] Expected: `dbo.Disciplines` contains PIPING, INSTRUMENTATION; `dbo.DatasheetSubtypes` contains PRESSURE_TRANSMITTER for INSTRUMENTATION.

### 3.3 Seed script

- [ ] From project root: `npx tsx scripts/seed/seed-instrumentation-template.ts` (exit 0).
- [ ] Expected: console shows *Created template "Instrument Datasheet – Pressure Transmitter" (SheetID=…)*.

### 3.4 Expected results (UI)

- [ ] **Templates list:** Filter by Discipline → Instrumentation shows **Instrument Datasheet – Pressure Transmitter** with **Instrumentation** badge.
- [ ] **Template detail:** Header shows **Instrumentation · Pressure Transmitter** (or discipline · subtype when present).
- [ ] **Create filled sheet** from that template succeeds.
- [ ] **Filled list:** Filter by Instrumentation shows the new filled sheet with **Instrumentation** badge.
- [ ] **Filled sheet detail:** Header shows **Instrumentation · Pressure Transmitter**.

---

## 4. Phase 1 release note (README / LinkedIn)

**Short (README):**

> **Phase 1 – Multi-discipline support.** SpecVerse now supports multiple engineering disciplines end-to-end: disciplines and subtypes are stored and displayed on templates and filled datasheets, with filter dropdowns and badges on list and detail views. Seed data adds PIPING and INSTRUMENTATION (with Pressure Transmitter subtype); an optional seed script creates a demo Instrumentation template. No schema redesign—built on existing Disciplines and DatasheetSubtypes.

**LinkedIn / portfolio (2–3 sentences):**

> Shipped Phase 1 multi-discipline support for SpecVerse: discipline and subtype are wired through the backend and UI, with filters and badges on template and filled-datasheet lists and detail headers. Demo flow: filter templates by Instrumentation → open Pressure Transmitter template → create filled sheet → filter filled list by Instrumentation and confirm the header shows *Instrumentation · Pressure Transmitter*. Repeatable demo and screenshot checklist documented for portfolio and handover.

---

*Doc: `docs/phase1/phase1-demo-verification-plan.md` — Phase 1 Demo & Verification Plan*
