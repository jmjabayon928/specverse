# Unit/UOM Hardening – End-to-End Verification Checklist

Verify unit/uom hardening with no code changes unless a failure is reproduced.

**Prerequisites:** App running (`npm run dev`), logged in with a user that can create/edit filled sheets and export.

---

## 1. Create filled sheet (templateId=1239)

**Action:**
- Go to **Create Filled Sheet** with template: `/datasheets/filled/create?templateId=1239` (or pick template 1239 in the UI).
- Use a template that has decimal + option fields (e.g. decimals 2/2 and options A/D).
- Set decimal fields to **2** and **2** (or the two decimal values required).
- Set option fields to **A** and **D**.
- Submit the form.

**Pass:** Sheet is created successfully (201 / redirect to new sheet or success message). No console or runtime errors.

**On failure capture:**
- Stack trace (browser console or server logs).
- Request payload (POST body for create).
- Response body (or error message).
- Any field mentioned in the error and its `uom`/`unit` value if shown.

---

## 2. Open viewer (no runtime error; conversions panel)

**Action:**
- Open **Viewer** for the new sheet: `/datasheets/filled/<newId>` (replace `<newId>` with the ID from step 1).
- Ensure the page loads and the “Other Conversions” / conversions panel is visible where applicable.

**Pass:** Page loads with no runtime error. Conversions panel renders. No `.trim()` or type errors in console.

**On failure capture:**
- Stack trace (browser console).
- Response body for `GET /api/backend/filledsheets/<newId>` (if applicable).
- The field(s) and their `uom`/`unit` value(s) used when the error occurs (e.g. from network payload or UI).

---

## 3. Open edit and submit values-only

**Action:**
- Open **Edit** for the same sheet: `/datasheets/filled/<newId>/edit`.
- Change only **Information Values** (e.g. one decimal or option), leave header/metadata as-is.
- Click **Update Filled Sheet** / Submit.

**Pass:** Submit succeeds (200 or redirect/success). No “uom: Expected string, received array” or other uom-related schema errors. No console/runtime errors.

**On failure capture:**
- Stack trace (browser console or server).
- Request payload (PUT body for update).
- Response body (e.g. 400 with `fieldErrors` or message).
- The offending field’s `uom`/`unit` value in the payload or response.

---

## 4. Export PDF + Excel

**Action:**
- From the same filled sheet (view or edit page), use **Export PDF** and **Export Excel** (if the UI exposes them; e.g. `ExportSheetButtons` or export links).
- API paths: `GET /api/backend/filledsheets/export/<newId>/pdf` and `GET /api/backend/filledsheets/export/<newId>/excel` (with `?uom=SI` or `?uom=USC` and `&lang=...` as needed).

**Pass:** Both exports complete without crash. A PDF and an Excel file are generated (download or 200 response with correct `Content-Type`).

**On failure capture:**
- Stack trace (browser or server).
- Request URL and query (e.g. `?uom=SI` or `?uom=USC`).
- Response status and body (if any).
- The field’s `uom`/`unit` value used in the export path if the error references it.

---

## Done when

All four steps pass with **no console/runtime errors**.

If any step fails, use the “On failure capture” items for that step and attach them when reporting the issue so the offending field’s `uom`/`unit` and request/response can be inspected.
