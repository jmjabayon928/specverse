# PR summary — Datasheet performance polish v0.5 (release/v0.5)

## PR-ready summary (5–8 bullets)

- **Stable callbacks:** Wrapped `handleChange` and `handleFieldValueChange` in `useCallback` in `FilledSheetEditorForm` so child memoization is effective.
- **Memoized subsheet form:** Wrapped `FilledSheetSubsheetForm` in `React.memo` and pass section completeness as `sectionTotalRequired` / `sectionFilledRequired` so other subsheets can skip rerender when only one subsheet’s data changes.
- **Debounced completeness (display only):** `debouncedFieldValues` (250 ms) used only for `useDatasheetCompleteness`; submit, validation, and payload still use live `fieldValues`.
- **Memoized field row:** Extracted `FilledSheetFieldRow` (React.memo) in `FilledSheetSubsheetForm` so only the edited row rerenders on keystroke.
- **Memoized viewer:** Extracted `SubsheetSection` and `ViewerFieldRow` (React.memo) in `FilledSheetViewer` so only sections/rows with changed props rerender (e.g. unit/language toggle).
- **Why it’s safe:** Submit and validation use live `fieldValues` only; completeness is guidance-only; no API/backend/config or behavior changes.
- **How verified:** `npm run lint`, `npm run type-check`, `npm test -- --runInBand --no-cache`; manual Profiler (edit: only edited row highlights; viewer: unit/language toggle) and submit payload/validation checks.

---

## Rollback order (newest → oldest)

1. `perf(filled-sheet-view): memoize subsheet section rendering`
2. `perf(filled-sheet-edit): memoize field row rendering`
3. `perf(filled-sheet-edit): debounce completeness display only`
4. `perf(filled-sheet-edit): memoize subsheet form and pass completeness primitives`
5. `perf(filled-sheet-edit): stabilize edit form callbacks`
6. `docs(datasheets): add performance polish checklist and wrap-up`

Revert in that order for full rollback. Commits 1 and 5 can be reverted independently; 2–4 are best reverted together (4 → 3 → 2) when rolling back only the edit perf work.
