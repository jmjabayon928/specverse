# Finalize Option 5 — Run these commands locally

Git write operations fail in Cursor (permission denied when creating `.git/index.lock`). Run the following **from repo root** in an **external terminal** (e.g. PowerShell or Windows Terminal), not inside Cursor.

## 0) Unblock Git (Windows)

- **Use an external terminal** so Cursor/VS Code Git integration is not holding the index.
- Run: `git status`
  - If it works: no lock; continue to step 1.
  - If it fails with "index.lock": check for other git processes (Git GUI, Git Graph, another terminal). Close them or wait, then retry.
- If **"Permission denied" when creating** `.git/index.lock`: the environment (e.g. Cursor) is blocking writes to `.git`. **Run all commands below in an external terminal** (outside Cursor) where git has write access.
- If a **stale** lock exists and no git process is running: remove it only then:  
  `Remove-Item -Force .git/index.lock`  
  Then: `git status` (must succeed).

## 1) Confirm state

```powershell
git status -u
git diff --stat
```

Expected: modified `FilledSheetEditorForm.tsx`, `FilledSheetSubsheetForm.tsx`, `FilledSheetViewer.tsx`; untracked checklist + wrap-up. Do **not** commit `tsconfig.tsbuildinfo`.

## 2) Restore build artifact

```powershell
git restore tsconfig.tsbuildinfo
```

## 3) Commit docs first

```powershell
git add docs/datasheet-performance-polish-v0.5-checklist.md docs/datasheet-performance-polish-v0.5-wrap-up.md
git commit -m "docs(datasheets): add performance polish checklist and wrap-up"
```

Run: `npm run lint`, `npm run type-check`, `npm test -- --runInBand --no-cache`

## 4) Commit code in 5 commits (oldest → newest)

The working tree has **all** perf changes combined. To get 5 separate commits you must use **interactive staging** (`git add -p`) and stage only the hunks that belong to each commit.

### (a) perf(filled-sheet-edit): stabilize edit form callbacks

- Stage **only** in `FilledSheetEditorForm.tsx`: the `useCallback` import, and the two handlers wrapped in `useCallback(..., [])`.  
- Do **not** stage: debounce state/effect, completeness using debouncedFieldValues, or subsheet primitives.
- Commit:
  ```powershell
  git add -p "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx"
  # Accept (y) only hunks for useCallback + handleChange + handleFieldValueChange. Skip (n) the rest.
  git commit -m "perf(filled-sheet-edit): stabilize edit form callbacks"
  ```
- Run: lint, type-check, test.

### (b) perf(filled-sheet-edit): memoize subsheet form and pass completeness primitives

- Stage in `FilledSheetEditorForm.tsx`: the subsheet map that uses `sectionKey` / `sectionComp` and passes `sectionTotalRequired` / `sectionFilledRequired`.
- Stage in `FilledSheetSubsheetForm.tsx`: the Props change (primitives instead of `sectionCompleteness`), the inner component rename, `SectionCompletenessSummary` using primitives, and `export default React.memo(...)`.
- Do **not** stage: debounce, or the `FilledSheetFieldRow` extraction.
- Commit:
  ```powershell
  git add -p "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx"
  git add -p "src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx"
  git commit -m "perf(filled-sheet-edit): memoize subsheet form and pass completeness primitives"
  ```
- Run: lint, type-check, test.

### (c) perf(filled-sheet-edit): debounce completeness display only

- Stage in `FilledSheetEditorForm.tsx`: `debouncedFieldValues` state, the `useEffect` that sets it from `fieldValues` (250 ms), and the change to `useDatasheetCompleteness(..., debouncedFieldValues)`.
- Commit:
  ```powershell
  git add -p "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx"
  git commit -m "perf(filled-sheet-edit): debounce completeness display only"
  ```
- Run: lint, type-check, test.

### (d) perf(filled-sheet-edit): memoize field row rendering

- Stage in `FilledSheetSubsheetForm.tsx`: the entire `FilledSheetFieldRow` component (props, inner, memo), and the map that renders `<FilledSheetFieldRow ... />` with key `String(field.id ?? field.originalId ?? index)` and value/errorMessage/onFieldValueChange/subsheetIndex/fieldIndex.  
- Do **not** stage: viewer changes or the keying fix in the same file (if any).
- Commit:
  ```powershell
  git add -p "src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx"
  git commit -m "perf(filled-sheet-edit): memoize field row rendering"
  ```
- Run: lint, type-check, test.

### (e) perf(filled-sheet-view): memoize subsheet section rendering

- Stage **all** remaining changes: `FilledSheetViewer.tsx` (SubsheetSection, ViewerFieldRow, map using them), and any remaining hunk in `FilledSheetSubsheetForm.tsx` (e.g. keying `(fieldValues as Record<string, string>)[String(...)]`).
- Commit:
  ```powershell
  git add "src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx" "src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx"
  git commit -m "perf(filled-sheet-view): memoize subsheet section rendering"
  ```
- Run: lint, type-check, test.

## 5) Push

```powershell
git push origin release/v0.5
```

## 6) Confirm clean

```powershell
git status
```

You should see clean working tree (and no `tsconfig.tsbuildinfo` in the last commit).
