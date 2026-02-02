# Template Detail — varchar Fields “Disappear” Discovery

## 1) Template detail route implementation

- **Next.js page:** `src/app/(admin)/datasheets/templates/[id]/page.tsx`
- **Client wrapper:** `src/app/(admin)/datasheets/templates/[id]/TemplatePageClient.tsx`
- **View component:** `src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx`

The detail route is the dynamic segment `[id]` under `(admin)/datasheets/templates/`. No layout in that folder overrides data.

---

## 2) How the page loads data

- **Server (RSC):** The page component calls `getTemplateDetailsById(sheetId, defaultLanguage)` from `@/backend/services/templateService` (no client fetch for initial load).
- **No template-detail GET on first load:** DevTools showing only `GET /api/backend/sheets/1239/logs` is expected; template payload is produced server-side and passed as props to the client.
- **When lang/unit change:** `TemplatePageClient` fetches `GET /api/backend/templates/${sheetId}?lang=...&uom=...` and sets `translatedTemplate` from `data.datasheet`.

So: **initial data** = server `getTemplateDetailsById` → `template` prop → `TemplatePageClient` → `TemplateViewer`. **After lang/uom change** = `GET /api/backend/templates/:id` → `data.datasheet` → same viewer.

---

## 3) Template details API

- **Handler:** `getTemplateById` in `src/backend/controllers/templateController.ts` (around line 318).
- **Route:** `GET /api/backend/templates/:id` (see `src/backend/routes/templateRoutes.ts` ~151).
- **Implementation:** Calls `getTemplateDetailsById(templateId, lang)` and returns `{ datasheet, translations }`. It does **not** pass `uom`; the service uses default `uom = 'SI'`.
- **Return shape:** `datasheet` is a `UnifiedSheet`: `subsheets[]` with `{ id, name, fields: InfoField[] }`, each field having `id`, `label`, `infoType`, `uom?`, `sortOrder`, `required`, `options?`, `value?`.

---

## 4) Where fields could be filtered/dropped

**Backend (`getTemplateDetailsById` in `src/backend/services/templateService.ts` ~1798–1851):**

- Query: `SELECT InfoTemplateID, Label, InfoType, UOM, Required, OrderIndex FROM InformationTemplates WHERE SubID = @SubID ORDER BY OrderIndex`. **No filter on InfoType or UOM.**
- Fields are built with `templateResult.recordset.map(async (t) => { ... })` — one `InfoField` per row. `infoType` is cast as `'int' | 'decimal' | 'varchar'`; `uom` is `t.UOM ?? undefined` (so varchar rows with `UOM = NULL` get `uom: undefined`).
- **No code path found** that skips rows or filters by `InfoType` or `UOM`.

**Frontend:**

- **TemplateViewer** (~366–456): Renders `data.subsheets` and, for each `sub`, uses `sub.fields` via `sub.fields.slice(0, midpoint)` / `sub.fields.slice(midpoint)`. **No `.filter()` on fields; no check on `infoType` or `uom`.**
- **TemplatePageClient:** Passes `translatedTemplate` (initialized from server `template`) into `TemplateViewer` as `data`. No filtering of subsheets or fields.
- Searches for `.filter` on fields, `infoType === 'int' | 'decimal'`, or logic that drops fields when `uom` is falsy in the template detail/edit flow found **no** such filter in the template detail path. (The only relevant filter is in `FilledSheetSubsheetForm.tsx` for input type, not for inclusion of fields.)

**Conclusion:** No explicit backend or frontend code path was found that drops varchar fields by type or by `uom`.

---

## 5) Fetch vs render

- **Fetch:** The detail page **does** load full template details: via server `getTemplateDetailsById` on initial load, and via `GET /api/backend/templates/:id` when lang/uom change. There is no separate “subsheets + fields” endpoint; the same `getTemplateDetailsById` result carries all subsheets and fields.
- **Render:** `TemplateViewer` iterates over `data.subsheets` and then `sub.fields` with no filter. It does **not** guard against `sub.fields` being undefined: it uses `sub.fields.length` and `sub.fields.slice(...)` directly. If `sub.fields` were ever undefined, that would throw and break the page, not “hide” only varchar.
- **Varchar in response:** Backend builds one field per `InformationTemplates` row and does not exclude by `InfoType`. So varchar rows (with `UOM = NULL` → `uom: undefined`) **should** be present in the returned `datasheet.subsheets[].fields`.
- **Possible failure modes if varchar still don’t show:**
  1. **RSC serialization:** When passing `template` from Server Component to Client Component, Next.js serializes props. If serialization ever dropped or altered array elements for objects with many `undefined` values (e.g. `uom: undefined`), that could remove fields. This is not something the codebase controls explicitly.
  2. **Missing defensive handling:** `sub.fields` is not normalized; if the server ever sent a subsheet without `fields`, `sub.fields.length` would throw. So the current code assumes `fields` is always present and an array.

---

## Root cause (one sentence)

**No code path in the traced flow (backend `getTemplateDetailsById` or frontend TemplatePageClient/TemplateViewer) explicitly filters out varchar fields; the most plausible remaining causes are RSC/client serialization of props when field `uom` is undefined, or a missing defensive normalization of `sub.fields` so that undefined/malformed subsheet data doesn’t lead to missing or broken rendering.**

---

## Evidence (minimal)

**Backend — no InfoType filter, one field per row:**

```1801:1843:src/backend/services/templateService.ts
    const templateResult = await pool
      .request()
      .input('SubID', sql.Int, sub.SubID)
      .query(`
        SELECT InfoTemplateID, Label, InfoType, UOM, Required, OrderIndex
        FROM InformationTemplates
        WHERE SubID = @SubID
        ORDER BY OrderIndex
      `)
    // ...
    const fields: InfoField[] = await Promise.all(
      templateResult.recordset.map(async (t) => {
        // ...
        const field: InfoField = {
          id: t.InfoTemplateID,
          label: t.Label,
          infoType: t.InfoType as 'int' | 'decimal' | 'varchar',
          uom: displayUom,  // t.UOM ?? undefined
          // ...
        }
        return field
      })
    )
```

**Frontend — no filter on fields:**

```366:391:src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx
        {Array.isArray(data.subsheets) && data.subsheets.length > 0 ? (
          // ...
            {data.subsheets.map((sub) => {
              // ...
              const midpoint = Math.ceil(sub.fields.length / 2)
              const leftFields = sub.fields.slice(0, midpoint)
              const rightFields = sub.fields.slice(midpoint)
              // ... renders leftFields and rightFields
```

---

## Minimal fix proposal

1. **Defensive `sub.fields` in TemplateViewer**  
   Ensure every subsheet is rendered with a safe fields array so that missing or undefined `fields` never cause a throw and never hide rows:
   - When iterating subsheets, use `const fields = sub.fields ?? []` (or equivalent) and use `fields.length` / `fields.slice` for layout and rendering.
   - This does not fix serialization, but it avoids crashes and makes behavior consistent when `fields` is missing.

2. **Backend sanity check (optional)**  
   In `getTemplateDetailsById`, after building `fields` for each subsheet, optionally assert or log that `fields.length` matches the number of rows returned for that `SubID`, so any future filtering or driver oddity is visible.

3. **If varchar are still missing after (1)**  
   - Add temporary logging: in `getTemplateDetailsById` log per-subsheet field count and `infoType` list; in `TemplateViewer` (or TemplatePageClient) log `data.subsheets` and each `sub.fields.length` on mount.  
   - Compare server logs vs client logs to see if the drop happens in serialization (server has varchar, client doesn’t).  
   - If the drop is on the client, consider ensuring varchar fields always have a serializable `uom` (e.g. backend sends `uom: null` or `uom: ''` instead of omitting it) so that RSC serialization does not alter the array.

---

## Files to change (smallest set)

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx` | When iterating `data.subsheets`, derive a safe fields array per sub (e.g. `const fields = sub.fields ?? []`) and use it for `midpoint`, `slice`, and the table body so that undefined or missing `sub.fields` never causes a throw or implicit drop. |
| 2 (optional) | `src/backend/services/templateService.ts` | After building `fields` for each subsheet in `getTemplateDetailsById`, add a short comment (or dev-only assert) that we do not filter by InfoType and that `fields.length` should match the InformationTemplates row count for that SubID. |
| 3 (if needed) | Backend field shape | If logging shows varchar fields are present in the service result but missing in the client payload, ensure each `InfoField` has a serializable `uom` (e.g. `uom: displayUom ?? null` or `uom: displayUom ?? ''`) so that RSC serialization does not drop or alter array elements. |

---

## Guardrails

- No schema changes.
- No feature expansion.
- No refactors beyond the defensive `sub.fields` handling and optional logging/comment.
- Fix remains minimal and surgical until the exact drop point is proven (e.g. by the suggested logging).

---

## Fix implemented (instrumentation removed)

- **Backend:** In `getTemplateDetailsById`, field objects use `uom: displayUom ?? ''` and `options: options ?? []` so RSC/JSON never receive `undefined` (serializable shape).
- **Frontend:** `TemplateViewer` uses `const fields = sub.fields ?? []` for layout/table so missing `sub.fields` never throws.
