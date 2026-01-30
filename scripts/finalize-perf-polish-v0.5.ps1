# Finalize Option 5 — Datasheet performance polish (release/v0.5)
# Run from repo root: .\scripts\finalize-perf-polish-v0.5.ps1
# Requires: git status clean of other changes; only perf + docs changes present.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "1) Restore tsconfig.tsbuildinfo (do not commit)"
git restore tsconfig.tsbuildinfo

Write-Host "2) Commit docs"
git add docs/datasheet-performance-polish-v0.5-checklist.md docs/datasheet-performance-polish-v0.5-wrap-up.md
git commit -m "docs(datasheets): add performance polish checklist and wrap-up"

Write-Host "3) Commit (a) perf(filled-sheet-edit): stabilize edit form callbacks"
git add "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx"
# Stage only the useCallback/useState changes; if the file has mixed hunks, use: git add -p "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx"
# For a single combined code commit instead of 5, replace steps 3-7 with one commit:
# git add "src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx" "src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx" "src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx"
# git commit -m "perf(datasheets): polish filled sheet edit and view (memo, debounce, stable callbacks)"
git status
# If partial staging is needed, run manually: git add -p for each file and commit a,b,c,d,e separately.
# This script assumes you will do the 5 code commits manually via git add -p, OR commit all code in one commit (see comment above).

Write-Host "Done. Run: npm run lint, npm run type-check, npm test -- --runInBand --no-cache"
Write-Host "Then: git push origin release/v0.5"
