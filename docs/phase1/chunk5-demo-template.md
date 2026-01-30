# Phase 1 Chunk 5: Demo Template & Seed Data

This document describes how to run the Phase 1 Chunk 5 seed scripts and verify the instrumentation template end-to-end.

## Prerequisites

- Database with SpecVerse schema (Disciplines and DatasheetSubtypes tables exist; see `verify-discipline-schema.sql`).
- At least one row each in: Categories, Users, Clients, Projects, Areas, Manufacturers, Suppliers (create via the app or existing data).

## 1. Run seed SQL

Run the discipline and subtype seed script against your database (manual run only; do **not** wire this to app startup):

```bash
# Example using sqlcmd (adjust connection for your environment)
sqlcmd -S your_server -d your_database -U your_user -P your_password -i docs/phase1/chunk5-seeds.sql
```

Or open `docs/phase1/chunk5-seeds.sql` in SSMS / Azure Data Studio and execute it.

This inserts:

- **Disciplines:** PIPING, INSTRUMENTATION (and optionally ELECTRICAL if you uncomment).
- **DatasheetSubtypes:** PRESSURE_TRANSMITTER under INSTRUMENTATION (and optionally TEMPERATURE_TRANSMITTER if you uncomment).

Optional backfill (commented out in the script): set `DisciplineID = PIPING` on existing Sheets where `DisciplineID IS NULL`. Uncomment and run only if desired.

## 2. Run instrumentation template seed script

From the **project root**, with `.env` configured (DB_* variables):

```powershell
npx tsx scripts/seed/seed-instrumentation-template.ts
```

Or:

```powershell
node --import tsx scripts/seed/seed-instrumentation-template.ts
```

The script:

- Reads the first Category, User, Client, Project, Area, Manufacturer, and Supplier from the DB.
- Resolves INSTRUMENTATION discipline and PRESSURE_TRANSMITTER subtype (from chunk5-seeds.sql).
- Inserts one template sheet: **"Instrument Datasheet – Pressure Transmitter"** with subsheets:
  - Process Data  
  - Electrical/Signal  
  - Mechanical/Connections  
  - Materials  
  - Certifications/Notes  

and ~20 information template fields with realistic labels, types (`int`/`decimal`/`varchar`), and UOMs (e.g. kPa(g), °C, kg).

If any reference row or discipline/subtype is missing, the script exits with a clear message; fix data or run chunk5-seeds.sql first.

## 3. Verification steps

### 3.1 Run seed SQL

- Execute `chunk5-seeds.sql` and confirm no errors.
- Optionally: `SELECT * FROM dbo.Disciplines` and `SELECT * FROM dbo.DatasheetSubtypes` to confirm PIPING, INSTRUMENTATION, and PRESSURE_TRANSMITTER.

### 3.2 Templates list: filter by Instrumentation

1. Go to **Templates** list (e.g. `/datasheets/templates`).
2. Use **Filter by Discipline** → **Instrumentation**.
3. Confirm **"Instrument Datasheet – Pressure Transmitter"** appears with badge **Instrumentation**.

### 3.3 Create a filled sheet from the template

1. Open the template **"Instrument Datasheet – Pressure Transmitter"**.
2. Create a filled sheet from it (use the app’s “Create Filled Sheet” / “New from template” flow).
3. Confirm the filled sheet is created without error.

### 3.4 Filled list: filter and detail header

1. Go to **Filled** list (e.g. `/datasheets/filled`).
2. Use **Filter by Discipline** → **Instrumentation**.
3. Confirm the new filled sheet appears in the list.
4. Open that filled sheet.
5. In the **detail header**, confirm it shows: **Instrumentation · Pressure Transmitter**.

## Stop conditions (Chunk 5)

- Template appears in the UI under Instrumentation (filter + badge).
- Filled sheet created from it inherits discipline/subtype and appears when filtering the Filled list by Instrumentation.
- Filled sheet detail header shows **Instrumentation · Pressure Transmitter**.
- No other features or files are changed (backend, UI, exports unchanged except for added seed script and docs).

## Files delivered

| File | Purpose |
|------|--------|
| `docs/phase1/chunk5-seeds.sql` | Disciplines + DatasheetSubtypes + optional backfill (manual run). |
| `scripts/seed/seed-instrumentation-template.ts` | Node/TS script to create the Instrumentation pressure transmitter template (run with `npx tsx` from project root). |
| `docs/phase1/chunk5-demo-template.md` | This file: how to run seeds and verify. |
