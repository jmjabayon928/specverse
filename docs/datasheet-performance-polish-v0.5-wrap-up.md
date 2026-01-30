# Datasheet performance polish v0.5 — wrap-up

**Branch:** release/v0.5  
**Commits:** 1–5 (all implemented)

---

## 1) Before vs after verification summary (React DevTools Profiler)

### Editor (single keystroke in one subsheet field)

**Before (Commits 1–5):**
- On every keystroke: **FilledSheetEditorForm** rerendered (state: `fieldValues`, `datasheet`).
- **All** **FilledSheetSubsheetForm** instances rerendered (new `fieldValues` ref, new `subsheet` ref, new `onFieldValueChange` ref, new `sectionCompleteness` ref).
- Inside each subsheet: **all** field rows rerendered (single `renderField` function; no per-row components).
- **Completeness** recomputed every keystroke (`useDatasheetCompleteness(datasheet.subsheets, fieldValues)` with new `fieldValues` ref).
- **Profiler:** Entire form tree and every subsheet/field lit up on each keystroke.

**After (Commits 1–5):**
- **FilledSheetEditorForm** still rerenders on keystroke (state update).
- **FilledSheetSubsheetForm** instances: with memo + primitive section props + stable `onFieldValueChange`, only the subsheet that contains the edited field gets new props (`fieldValues` and `subsheet` change); other subsheets can skip rerender when their props are referentially/primitive equal (depends on completeness debounce and whether that subsheet’s slice of data changed).
- **FilledSheetFieldRow** (memo): only the row whose **value** (and possibly **field**) changed rerenders; sibling rows and other subsheets keep same props and skip rerender.
- **Completeness** runs at most every 250 ms (debounced `debouncedFieldValues`); `computeCompleteness` no longer runs on every keystroke.
- **Profiler:** On a single keystroke you should see: root form, the one subsheet section that contains the field, and **only the one FilledSheetFieldRow** for that field (and possibly the banner when debounce fires). Other subsheet sections and other field rows should not highlight.

### Viewer (unit system or language toggle)

**Before:**
- **FilledSheetViewer** rerendered (e.g. `unitSystem` or `language` state change).
- The whole **subsheet map** re-ran: every fieldset and every table row rerendered (no SubsheetSection or ViewerFieldRow memo).
- **Profiler:** Entire viewer and all subsheet sections/rows lit up.

**After:**
- **FilledSheetViewer** still rerenders on toggle.
- **SubsheetSection** (memo): receives `subsheet`, `sectionCompleteness`, `language`, `unitSystem`, `subsheetLabelMap`, `fieldLabelMap`. When only unrelated parent state changes, sections with unchanged props skip rerender. When `unitSystem` or `language` changes, **all** sections get new props and rerender (expected).
- **ViewerFieldRow** (memo): receives `field`, `unitSystem`, `translatedLabel`. When `unitSystem` or `language` changes, all rows in visible sections get new props and rerender (expected). When parent rerenders for other reasons and section/row props are unchanged, rows skip rerender.
- **Profiler:** On unit/language toggle you should see: viewer root and all **SubsheetSection**s and **ViewerFieldRow**s that depend on unit/language (so they correctly update). On unrelated parent rerenders, memoized sections/rows with same props should not highlight.

---

## 2) Invariants — explicit checks

### Submit payload uses live `fieldValues` (not debounced)

- **FilledSheetEditorForm.tsx** `handleSubmit` (lines 166–209):
  - `sheetToValidate` is built with **`fieldValues`** (line 175: `value: fieldValues[field.id?.toString() ?? ''] || ''`).
  - **Payload** is `{ ...datasheet, fieldValues }` (lines 194–197) using **`fieldValues`**.
  - **`debouncedFieldValues`** is only used for `useDatasheetCompleteness` (line 145); it is **not** used in `handleSubmit`, `sheetToValidate`, or the payload.
- **Conclusion:** Submit payload and request body use live **`fieldValues`** only.

### Validation uses live `fieldValues`

- **FilledSheetEditorForm.tsx** `handleSubmit`:
  - `sheetToValidate` is built from **`datasheet`** and **`fieldValues`** (lines 168–176).
  - `unifiedSheetSchema.safeParse(sheetToValidate)` and `validateParsedSheet(parsed)` operate on that sheet, which reflects **live `fieldValues`**.
  - **Conclusion:** Validation uses live **`fieldValues`**; no debounced values.

### Completeness remains guidance-only

- **Completeness** is used only for:
  - **SheetCompletenessBanner** (`totalRequired`, `filledRequired`).
  - **SectionCompletenessSummary** per subsheet (`sectionTotalRequired`, `sectionFilledRequired`).
  - **FieldCompletenessHint** (per-field incomplete hint) — driven by local `field.required` and `value`, not by the completeness hook.
- **Completeness** is **not** used in:
  - Submit, validation, or payload.
  - Disabling the submit button (submit stays enabled when required fields are empty).
- **Conclusion:** Completeness is guidance-only; it may lag by the debounce (250 ms) but never affects submit or validation.

### No API / backend / config changes

- No new or changed API routes, request/response shapes, or backend services.
- No changes to `package.json`, Next/ESLint/TypeScript config, or env.
- **Conclusion:** No API, backend, or config changes.

---

## 3) Remaining low-risk cleanup

### FilledSheetSubsheetForm — `fieldValues` keying consistency

- **Current state:**
  - **FilledSheetEditorForm** and **FilledSheetClonerForm** use and pass **`Record<string, string>`** (keys are string IDs, e.g. `field.id?.toString()`).
  - **FilledSheetCreatorForm** uses **`Record<number, string>`**.
  - **FilledSheetSubsheetForm** types the prop as **`Record<number, string>`** and uses **`fieldValues[fieldKey as number]`** (with `fieldKey = field.id ?? field.originalId ?? index`).
- **Runtime:** In JavaScript, object keys are strings; `fieldValues[1001]` and `fieldValues["1001"]` both resolve to the same entry, so Editor (string keys) and Creator (number keys) both work.
- **Mismatch:** The editor uses string keys; the subsheet form types number and uses `fieldKey as number`. The cast is only for TypeScript; behavior is correct.

**Optional minimal fix (behavior unchanged):**

- In **FilledSheetSubsheetForm.tsx**, make the lookup key explicitly string so it matches Editor/Cloner and avoids `as number`:
  - Replace  
    `const value = fieldValues[fieldKey as number] ?? "";`  
  - with  
    `const value = (fieldValues as Record<string, string>)[String(field.id ?? field.originalId ?? index)] ?? "";`
- Keep the **Props** type as **`Record<number, string>`** so **FilledSheetCreatorForm** remains valid without change. The cast to `Record<string, string>` is only for the lookup and is safe because both number and string keys work at runtime.
- **Alternative:** If you prefer one type everywhere, you could change the prop to **`Record<string, string>`** and use **`fieldValues[String(field.id ?? field.originalId ?? index)] ?? ""** (then **FilledSheetCreatorForm** would need to pass an object typed or cast as `Record<string, string>`; runtime is already compatible).

**Recommendation:** Apply the one-line lookup change above for consistency and to avoid the `as number` cast; no change to Creator or to behavior.

**Applied:** The one-line lookup change has been applied in `FilledSheetSubsheetForm.tsx`: value is now `(fieldValues as Record<string, string>)[String(field.id ?? field.originalId ?? index)] ?? ""` with a brief comment. Behavior unchanged.

### Console / debug code

- **Checked:** No new `console.log` or debug code in the modified files (FilledSheetEditorForm, FilledSheetSubsheetForm, FilledSheetViewer).
- The only console in the edit flow is the existing **`console.error('❌ Submit error:', err)`** in **FilledSheetEditorForm** `handleSubmit` (pre-existing).
- **Conclusion:** No new console logs or debug code; no cleanup needed.

---

## Summary

- **Editor:** One keystroke now rerenders only the affected subsheet and the single edited field row (and optionally the banner when debounce fires); completeness is debounced for display only.
- **Viewer:** Unit/language toggle still updates all dependent sections/rows; unrelated rerenders can be skipped by memoized SubsheetSection and ViewerFieldRow.
- **Invariants:** Submit and validation use live **`fieldValues`**; completeness is guidance-only; no API/backend/config changes.
- **Optional cleanup:** One-line change in **FilledSheetSubsheetForm** to use string key for **`fieldValues`** lookup and remove the `as number` cast; behavior stays the same.
