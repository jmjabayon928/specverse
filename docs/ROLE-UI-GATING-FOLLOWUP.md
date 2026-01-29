# Role-based UI gating — follow-up (release/v0.5)

## 1) Jest fileMock — decision and config

**Decision: (A) Revert mock relocation; keep one config fix**

- **Reverted:** Added root `__mocks__/fileMock.ts` and removal of `tests/__mocks__/fileMock.ts`.
- **Restored:** `tests/__mocks__/fileMock.ts` (repo’s intended location for test mocks).
- **Removed:** Root `__mocks__/fileMock.ts`. If `__mocks__/` is now empty, delete the folder locally.

**Why the relocation wasn’t required:**  
The UI gating tests only need `.svg` (and other assets) to resolve when Jest loads components (e.g. AppSidebar → icons → `.svg`). That only requires the `moduleNameMapper` to point at an existing file. The repo already had a mock under `tests/__mocks__/`; the config pointed at a non-existent root path. Fixing the mapping to that file is enough.

**Config change (strictly necessary):**  
`jest.config.ts` originally had:

```ts
'\\.(svg|png|jpg|jpeg|gif|webp|avif)$': '<rootDir>/__mocks__/fileMock.ts',
```

That path didn’t exist (file lived under `tests/__mocks__/`). It’s now:

```ts
'\\.(svg|png|jpg|jpeg|gif|webp|avif)$': '<rootDir>/tests/__mocks__/fileMock.ts',
```

So: no new top-level `__mocks__`, single canonical location `tests/__mocks__/fileMock.ts`, and mapping is correct and unambiguous.

**Verification:** `npm test -- --runInBand --no-cache` passes (including `tests/ui/AppSidebar.test.tsx` and `tests/ui/SecurePage.test.tsx`).

---

## 2) Build [spawn EPERM] — environment vs. our changes

**Conclusion: Environment-specific, not caused by UI gating changes.**

- The failure happens in the step **“Linting and checking validity of types”** (Next.js spawning a child for ESLint/type-check), not during compilation. Our changes don’t touch Next.js config, ESLint config, or spawn behavior.
- “✓ Compiled successfully” shows the app compiles; the error is `[Error: spawn EPERM]` when that child process is started. On Windows this often comes from: sandbox/AV blocking child processes, permissions, or path/env issues in the environment where `next build` runs.

**Short local verification checklist (Windows, PowerShell):**

1. Close other terminals/IDEs using the repo; ensure no lock on `.next` or node.
2. From repo root:
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run lint
   npm run type-check
   npm test -- --runInBand --no-cache
   npm run build
   ```
3. If `npm run build` still fails with `spawn EPERM`:
   - Run PowerShell as Administrator, or
   - Run the same commands from a normal (non-sandbox) cmd/PowerShell, or
   - Temporarily disable AV/sandbox for the project folder and retry.

No changes to Next.js config or tooling are required for this.

---

## 3) Git commands (commit breakdown)

Run from repo root. Adjust paths if you’ve renamed or moved files.

**Commit 1 — Permission key alignment**

```powershell
git add "src/app/(admin)/datasheets/templates/[id]/page.tsx" "src/app/(admin)/datasheets/templates/[id]/edit/page.tsx" "src/app/(admin)/datasheets/templates/[id]/clone/page.tsx" "src/app/(admin)/datasheets/templates/create/page.tsx" "src/app/(admin)/datasheets/templates/page.tsx" "src/app/(admin)/datasheets/filled/page.tsx" "src/app/(admin)/datasheets/revisions/page.tsx" "src/app/(admin)/dashboard/reports/page.tsx" "src/app/(admin)/dashboard/analytics/page.tsx" "src/components/datasheets/templates/TemplateActions.tsx"
git commit -m "chore(ui-perms): align datasheet/dashboard permission keys with backend"
```

**Commit 2 — SecurePage role gating**

```powershell
git add src/components/security/SecurePage.tsx "src/app/(admin)/audit-logs/page.tsx"
git commit -m "feat(security): add role gating to SecurePage for admin-only pages"
```

**Commit 3 — Sidebar gating**

```powershell
git add src/layout/AppSidebar.tsx
git commit -m "feat(nav): gate sidebar items by session role/permissions"
```

**Commit 4 — Users page Reset Password gating**

```powershell
git add "src/app/(admin)/settings/users/page.tsx"
git commit -m "feat(admin): hide reset-password UI for non-admin"
```

**Commit 5 — Estimation page**

```powershell
git add "src/app/(admin)/estimation/page.tsx"
git commit -m "chore(estimation): remove UI permission gate to match backend auth"
```

**Commit 6 — Tests**

```powershell
git add tests/ui/AppSidebar.test.tsx tests/ui/SecurePage.test.tsx
git commit -m "test(ui): add role/permission gating coverage for sidebar and SecurePage"
```

**Commit 7 — Jest fileMock follow-up**

```powershell
git add tests/__mocks__/fileMock.ts jest.config.ts
git commit -m "fix(jest): point moduleNameMapper at tests/__mocks__/fileMock.ts"
```

**Optional:** If you had added root `__mocks__/fileMock.ts` and it’s deleted, ensure the empty `__mocks__/` directory is not committed (it shouldn’t be if it’s empty and untracked). If it was ever tracked, run: `git rm -r --cached __mocks__ 2>$null; git status` and commit the removal if needed.

**One-shot (all UI gating + follow-up in one commit):**

```powershell
git add src/app/ src/components/security/SecurePage.tsx src/components/datasheets/templates/TemplateActions.tsx src/layout/AppSidebar.tsx tests/ui/AppSidebar.test.tsx tests/ui/SecurePage.test.tsx tests/__mocks__/fileMock.ts jest.config.ts
git status
git commit -m "feat(ui): role-based UI gating and jest fileMock fix"
```

Use the single-commit approach only if you don’t need the finer-grained history above.
