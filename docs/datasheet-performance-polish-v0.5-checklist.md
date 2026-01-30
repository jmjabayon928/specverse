# Datasheet performance polish (v0.5) — implementation checklist

**Branch:** release/v0.5  
**Goal:** Reduce unnecessary rerenders and expensive recomputation on large filled datasheets (edit + view) with minimal diffs and zero behavior change.

**Hard constraints:** No backend changes; no new deps/config/package.json; no change to submit payload, validation, save/verify/approve; completeness hints remain guidance-only (may be slightly delayed if debounced); small reviewable changes — memo/useMemo/useCallback and component extraction only.

---

## Discovery (confirmed)

### 1) Client components and state

| File | Client component? | Where state lives |
|------|-------------------|-------------------|
| **FilledSheetEditorForm.tsx** | Yes (`'use client'` at line 1) | All state in this component: `datasheet` (useState), `formErrors` (useState), `fieldValues` (useState). |
| **FilledSheetSubsheetForm.tsx** | Yes (`"use client"` at line 2) | No local state for field data; receives `fieldValues` and `onFieldValueChange` from parent. |
| **FilledSheetViewer.tsx** | No `'use client'` directive | No local state; uses `React.useMemo` (hooks). Always imported by client components (FilledSheetPageClient, verify/approve pages), so runs on client. |

### 2) Props that cause FilledSheetSubsheetForm to rerender on each keystroke

On every keystroke in any subsheet field, the parent (FilledSheetEditorForm) updates:

- `fieldValues` → new object reference (`setFieldValues(prev => ({ ...prev, [id]: value }))`)
- `datasheet` → new object reference (including new `subsheets` array with one field updated)

So **every** prop passed to **every** `FilledSheetSubsheetForm` instance changes or is recreated each time:

| Prop | Why it changes on keystroke |
|------|-----------------------------|
| **fieldValues** | New object reference every keystroke. |
| **subsheet** | Comes from `datasheet.subsheets[i]`; `datasheet` is replaced each time, so new reference. |
| **onFieldValueChange** | `handleFieldValueChange` is recreated every render (not wrapped in useCallback). |
| **sectionCompleteness** | From `completeness.bySubsheet[getSubsheetKey(sub, i)]`. `completeness` is recomputed every time because `useDatasheetCompleteness(datasheet.subsheets, fieldValues)` depends on `fieldValues` (new ref) → new `bySubsheet` → new object ref per section. |
| formErrors | Stable until submit/validation. |
| subsheetIndex | Stable. |
| key | Stable (`sub.id ?? i`). |

Result: all subsheet form instances rerender on every keystroke.

---

## A) Exact file-by-file change list (no code)

### File 1: `src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx`

**Add**

- `useCallback` import from React (if not already).
- Wrap `handleChange` in `useCallback` with dependency array that keeps it stable (e.g. empty deps; it only uses functional `setDatasheet`).
- Wrap `handleFieldValueChange` in `useCallback` with dependency array that keeps it stable (e.g. empty deps; it only uses functional `setFieldValues` and `setDatasheet`).
- Optional debounce for completeness display only: state or ref for a “display-only” copy of `fieldValues` (e.g. `debouncedFieldValues`), updated from `fieldValues` on a short timeout (e.g. 200–300 ms) in a `useEffect`. Call `useDatasheetCompleteness(datasheet.subsheets, debouncedFieldValues)` for banner and section hints only. Do **not** use debounced values in `handleSubmit`, validation, or payload — keep using real `fieldValues` and `datasheet` for those.

**Change**

- Where `FilledSheetSubsheetForm` is rendered: pass section completeness as two primitive props (e.g. `sectionTotalRequired` and `sectionFilledRequired`) derived from `completeness.bySubsheet[getSubsheetKey(sub, i)]`, instead of passing the object `sectionCompleteness`. This keeps the same numbers but avoids a new object ref every time completeness is recomputed (and, with debounce, completeness recomputes less often).

**Do not change**

- Submit handler: still build payload from `datasheet` and `fieldValues` (real, not debounced). Validation (`sheetToValidate`, `unifiedSheetSchema.safeParse`, `validateParsedSheet`) must use real `fieldValues`. No change to PUT body or success redirect.
- `buildFieldValueMap`, `flattenErrors`, `validateParsedSheet` logic.
- Any new validation rules or blocking behavior.

**Memoization**

- `handleChange` and `handleFieldValueChange` become stable refs so child memo can skip rerenders when other props are also stable or primitives.

---

### File 2: `src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx`

**Add**

- Wrap the default-exported component with `React.memo`.
- New internal component (e.g. `FilledSheetFieldRow`): receives one field’s data and a stable onChange. Props: e.g. `field`, `value` (string), `onChange` (e.g. `(value: string) => void` or same signature as current handler), `errorKey`, `errorMessage`, `subsheetIndex` (only if needed for error key). Renders one input or select + label + error. Wrap this component with `React.memo` so only the row whose `value` changed rerenders.

**Change**

- Props interface: replace `sectionCompleteness?: SubsheetCompleteness` with two optional primitives, e.g. `sectionTotalRequired?: number` and `sectionFilledRequired?: number`. Update usage: pass these into `SectionCompletenessSummary` (it already accepts `totalRequired` and `filledRequired`).
- Replace the `renderField` function + `subsheet.fields.map((field, index) => renderField(field, index))` with a `.map` that renders the new memoized row component. Pass per-field `value` from `fieldValues[field.id]`, and a stable callback: e.g. `(value) => onFieldValueChange(subsheetIndex, field.id!, value)` (parent’s `onFieldValueChange` will be stable after EditorForm changes). Use list key: `field.id ?? index` (prefer `field.id` when available).

**Do not change**

- Behavior: required/optional, options for select, input type (number vs text), error key format (`Subsheet #${subsheetIndex + 1} - Template #${index + 1} - value`), FieldCompletenessHint and SectionCompletenessSummary display. No new validation or blocking.

**Memoization**

- Whole form: `React.memo(FilledSheetSubsheetForm)` so it only rerenders when its props actually change (with parent passing stable callbacks and primitives for section completeness).
- Per-field row: `React.memo(FilledSheetFieldRow)` so only the row whose `value` prop changed rerenders on keystroke.

---

### File 3: `src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx`

**Add**

- Optional: `'use client'` at top for consistency (viewer uses hooks and is only used from client components). Not strictly required for behavior.
- Extract a memoized subsection component (e.g. `SubsheetSection`): receives one `subsheet`, `subIndex`, `completeness` slice for that subsection (`totalRequired`/`filledRequired` or the small object from `completeness.bySubsheet[key]`), `unitSystem`, `language`, and the translation/label helpers (or stable refs). Renders one fieldset: subsheet title, SectionCompletenessSummary, the two-column grid of tables with field rows. Wrap with `React.memo`.
- Optionally extract a single memoized row component (e.g. `ViewerFieldRow`) for the table rows: props = field, unitSystem, language, getTranslatedFieldLabel, getUILabel. Wrap with `React.memo` so only rows that need to update (e.g. when unitSystem or field value changes) rerender.

**Change**

- Replace the inline `sheet.subsheets.map(...)` block with mapping over `sheet.subsheets` and rendering the new `SubsheetSection` component, passing the same data as before (subsheet, index, completeness for that key, unitSystem, language, translation helpers). If extracting `ViewerFieldRow`, use it inside `SubsheetSection` for each field row.

**Do not change**

- Data flow: still use `sheet` from props; no new state. Completeness still from `computeCompleteness(sheet.subsheets)` (already memoized with `sheet.subsheets`). Notes/attachments grouping and rendering unchanged. OtherConversionsCell usage unchanged. ChangeLogTable, SheetCompletenessBanner, SectionCompletenessSummary behavior unchanged.
- No new deps; no config; no package.json.

**Memoization**

- `SubsheetSection` (and optionally `ViewerFieldRow`) memoized so that when parent rerenders (e.g. unit system toggle), only sections/rows that depend on changed data rerender; stable `sheet` and primitives help.

---

## B) Commit plan (5 commits max)

| # | Commit title | Files touched | Measurable improvement |
|---|--------------|---------------|-------------------------|
| 1 | `perf(dilled-sheet-edit): stabilize edit form callbacks with useCallback` | FilledSheetEditorForm.tsx | Enables downstream memo; no rerender reduction by itself until child is memoized. |
| 2 | `perf(filled-sheet-edit): memoize FilledSheetSubsheetForm and pass section completeness as primitives` | FilledSheetEditorForm.tsx, FilledSheetSubsheetForm.tsx | Fewer rerenders of other subsheet sections when typing in one; completeness still runs every keystroke until commit 3. |
| 3 | `perf(filled-sheet-edit): debounce completeness input for display only` | FilledSheetEditorForm.tsx | `computeCompleteness` runs at most every N ms instead of every keystroke; submit/validation still use real `fieldValues`. |
| 4 | `perf(filled-sheet-edit): extract memoized field row in FilledSheetSubsheetForm` | FilledSheetSubsheetForm.tsx | Only the edited field row rerenders on keystroke; sibling rows and other subsheets skip rerender. |
| 5 | `perf(filled-sheet-view): memoize subsheet section in FilledSheetViewer` | FilledSheetViewer.tsx | On view page, fewer unnecessary rerenders when parent rerenders; unit/language changes still update only affected sections/rows. |

---

## C) Verification plan

### Profiler steps

1. **Before any changes:** Open edit page for a filled sheet with multiple subsheets and many fields (e.g. SheetID 13 or a test sheet with many fields). Enable React DevTools “Highlight updates when components render.” Focus one subsheet input and type one character. Observe: entire form and all `FilledSheetSubsheetForm` instances highlight (full tree rerender).
2. **After commits 1–2:** Same action. Expect: only the subsheet section that contains the focused input (and possibly the banner) to highlight; other subsheet sections should not highlight if memo is effective and props are stable.
3. **After commit 4:** Same action. Expect: only the single field row (the input being typed in) and possibly the section completeness summary/banner to highlight.
4. **View page:** Open view page for same sheet. Toggle unit system (SI/USC). Before: entire viewer may rerender. After commit 5: only sections that depend on unitSystem (e.g. field value cells and OtherConversionsCell) should rerender; memoized sections with unchanged props can skip update if implemented correctly.

### Commands

- `npm run lint`
- `npm run type-check`
- `npm test -- --runInBand --no-cache`
- `npm run build`

### Manual invariants

- **Typing:** Typing in any subsheet field still updates the displayed value immediately; no delay or lost input.
- **Completeness hints:** Banner and section “X required fields missing” / “All required fields complete” still reflect current state; they may lag by the debounce interval (e.g. 200–300 ms) but must never affect submit or validation.
- **Submit payload:** Click “Update Filled Sheet”; request body must still include the same `fieldValues` and `datasheet` shape; no debounced or stale values in the payload.
- **Validation:** Leaving required fields empty and submitting still shows the same validation errors; no new blocking or validation rules.

---

**Stop. No code.** Use this checklist to implement in order; verify after each commit.
