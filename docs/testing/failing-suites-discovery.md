# Discovery — Fix remaining failing test suites (no code changes)

Discovery-only report for the two suites that still fail in full test run. No code or schema changes; minimal fix plans only.

---

## Suite 1: filledAttachments.delete.canonicalFirst

### A) Reproduce commands

```bash
cd c:\projects\specverse
npx jest tests/api/filledAttachments.delete.canonicalFirst.test.ts --no-cache
```

No special env vars required (e.g. `STRICT_FILLED_HEADER_GUARD` not used by this suite).

### B) Failure details

| Item | Detail |
|------|--------|
| **Test file** | `tests/api/filledAttachments.delete.canonicalFirst.test.ts` |
| **Failing tests** | 1. `uses canonical delete when link exists and does not call legacy delete`<br>2. `falls back to legacy delete when no canonical link is removed` |
| **Jest failure output (test 1)** | `expect(received).toBe(expected)` — Expected: 204, Received: 500. Console: `Failed to delete attachment TypeError: (0 , filledSheetService_1.bumpRejectedToModifiedDraftFilled) is not a function` at `deleteFilledSheetAttachmentHandler` (filledSheetController.ts:557:46), then `handleError` (filledSheetController.ts:139:11). |
| **Jest failure output (test 2)** | After fixing/avoiding the 500, `expect(jest.fn()).toHaveBeenCalledWith(...expected)` — Expected: 123, 555. Received: 123, 555, 1. Number of calls: 1. At line 133: `expect(deleteAttachmentByIdMock).toHaveBeenCalledWith(123, 555)`. |
| **Deterministic or flaky** | **Deterministic.** Both tests fail every run for the reasons below. |

### C) Call graph / code map

| Layer | File | Function / route |
|-------|------|-------------------|
| Route | `src/backend/routes/filledSheetRoutes.ts` | `DELETE /:id/attachments/:attachmentId` → `requirePermission('DATASHEET_ATTACHMENT_DELETE')`, `deleteFilledSheetAttachmentHandler` |
| Controller | `src/backend/controllers/filledSheetController.ts` | `deleteFilledSheetAttachmentHandler` (lines 537–566): parses params, gets user, calls `deleteSheetAttachmentLink(sheetId, attachmentId)`; if true, calls `bumpRejectedToModifiedDraftFilled(sheetId, user.userId)` then 204; else calls `deleteAttachmentById(sheetId, attachmentId, user.userId)` then 204. On error, `handleError(next, err, "Failed to delete attachment")` → 500. |
| Service (mocked) | `src/backend/services/filledSheetService.ts` | `deleteSheetAttachmentLink`, `deleteAttachmentById(sheetId, attachmentId, userId)`, `bumpRejectedToModifiedDraftFilled(sheetId, userId)` — controller imports all from here. |
| Test mock | `tests/api/filledAttachments.delete.canonicalFirst.test.ts` | `jest.mock('../../src/backend/services/filledSheetService', () => ({ ... }))` — provides `deleteSheetAttachmentLink` and `deleteAttachmentById` only; **does not** provide `bumpRejectedToModifiedDraftFilled`. |

No repository/query functions are invoked in the delete-attachment path; the handler only uses the above service functions.

### D) Root cause analysis

1. **Missing mock for `bumpRejectedToModifiedDraftFilled` (primary)**  
   The controller calls `bumpRejectedToModifiedDraftFilled(sheetId, user.userId)` when canonical delete succeeds (line 556). The test’s `filledSheetService` mock does not include this export, so it is `undefined` at runtime and the call throws “is not a function”, which is caught and turned into a 500.  
   **Evidence:** Stack trace points to filledSheetController.ts:557; mock object in test (lines 63–81) lists no `bumpRejectedToModifiedDraftFilled`.

2. **Arity mismatch on `deleteAttachmentById` (secondary, test 2)**  
   The real `deleteAttachmentById` has signature `(sheetId, attachmentId, userId)` (filledSheetService.ts:2338–2341). The controller passes three arguments (line 561). The test asserts `toHaveBeenCalledWith(123, 555)` (two arguments). The mock is invoked with `(123, 555, 1)`, so the assertion fails.  
   **Evidence:** Jest output “Expected: 123, 555. Received: 123, 555, 1.”

3. **Permission cookie**  
   Route requires `DATASHEET_ATTACHMENT_DELETE`; test uses `DATASHEET_ATTACHMENT_UPLOAD`. Because `checkUserPermission` is mocked to resolve `true`, the handler still runs. Fixing the mock and assertion is sufficient; updating the cookie is optional for consistency.

**Recent changes / Option A Step 1/2:** No direct change to this controller or to `bumpRejectedToModifiedDraftFilled` in Option A. The handler has called `bumpRejectedToModifiedDraftFilled` since it was added; the test mock was never updated to include it.

### E) Minimal fix plan (no implementation)

1. **Add mock for `bumpRejectedToModifiedDraftFilled`**  
   In `tests/api/filledAttachments.delete.canonicalFirst.test.ts`, add to the `filledSheetService` mock:  
   `bumpRejectedToModifiedDraftFilled: jest.fn().mockResolvedValue(undefined)`  
   So the first test no longer hits “is not a function” and returns 204.

2. **Fix `deleteAttachmentById` call assertion (test 2)**  
   Change the assertion to the real arity:  
   `expect(deleteAttachmentByIdMock).toHaveBeenCalledWith(123, 555, 1)`  
   (sheetId, attachmentId, userId from `asUser(req)` where userId = 1 from auth mock).

3. **Optional:** Use permission `DATASHEET_ATTACHMENT_DELETE` in `createAuthCookie` for both tests so the test matches the route contract.

**Tests to update:** Only `tests/api/filledAttachments.delete.canonicalFirst.test.ts` (mock + one assertion).

**Verification:**  
`npx jest tests/api/filledAttachments.delete.canonicalFirst.test.ts --no-cache` — both tests should pass.

---

## Suite 2: valuesets.filled timeout

### A) Reproduce commands

```bash
cd c:\projects\specverse
npx jest tests/api/valuesets.filled.test.ts --no-cache
# or full suite (timeout more likely with parallel workers):
npm test
```

No special env vars required. When the timeout occurs, it is in the first describe’s first test.

### B) Failure details

| Item | Detail |
|------|--------|
| **Test file** | `tests/api/valuesets.filled.test.ts` |
| **Failing test** | `Phase 2 value-set plumbing › GET filled sheet (same payload shape) › returns same payload shape with datasheet.subsheets and fields` |
| **Jest failure output** | `thrown: "Exceeded timeout of 5000 ms for a test."` at tests/api/valuesets.filled.test.ts (first `it('returns same payload shape...')`). No assertion failure; the test simply does not complete within the default timeout. |
| **Deterministic or flaky** | **Flaky.** When run in isolation (or with `--runInBand` together with the attachments suite), the suite often passes (e.g. “returns same payload shape…” ~1.7 s). When run in the full suite with default parallel workers, this test can exceed 5000 ms and fail. |

### C) Call graph / code map

| Layer | File | Function / route |
|-------|------|-------------------|
| Route | `src/backend/routes/filledSheetRoutes.ts` | `GET /:id` → `getFilledSheetById` (controller) |
| Controller | `src/backend/controllers/filledSheetController.ts` | `getFilledSheetById` → uses `getFilledSheetDetailsById` from filledSheetService |
| Service | `src/backend/services/filledSheetService.ts` | `getFilledSheetDetailsById` — **partially mocked**: test uses `jest.requireActual` and overrides only `getFilledSheetDetailsById` and `updateFilledSheet`. So the real module is loaded; only those two are replaced. |
| Test | `tests/api/valuesets.filled.test.ts` | `buildTestApp()` mounts `filledSheetRoutes` and `sheetRoutes`; first test does `GET /api/backend/filledsheets/42` with mocked `getFilledSheetDetailsById.mockResolvedValue(payload)`. |

Relevant mocks: `valueSetQueries` (getValueSetId, ensureRequirementValueSet, etc.) and `permissionQueries` are mocked; `filledSheetService` is required-actual with two overrides. So the GET handler runs with mocked `getFilledSheetDetailsById` and should return quickly. Slowdown is likely from Jest/Node loading the real `filledSheetService` (large module) or from worker/parallelism under full suite.

### D) Root cause analysis

1. **Default test timeout (5 s) vs. cold run / full suite**  
   The test that times out does a single GET with a mocked response; in isolation it often finishes in ~1.7 s. Under full suite, same test can exceed 5 s. Likely causes: first load of `filledSheetService` in a worker, or resource contention when many suites run in parallel.  
   **Evidence:** Same test passes with 15 s timeout or when run alone; failure is “Exceeded timeout of 5000 ms” with no assertion failure.

2. **Heavy module + requireActual**  
   Using `jest.requireActual('../../src/backend/services/filledSheetService')` pulls in the full service (and its dependency graph). In a busy worker, that cost can push the test over the default timeout.  
   **Evidence:** valuesets test is one of the few that use `requireActual` on filledSheetService; other API tests that fully mock the service don’t report this timeout.

3. **Option A Step 1/2**  
   No direct change to valuesets test or to the GET filled-sheet path. Step 1/2 added optional DTO fields and export logic; they do not add work in the GET handler that would explain a large delay. Timeout is environmental (parallelism + module load), not a behavioral regression.

### E) Minimal fix plan (no implementation)

1. **Raise timeout for the slow test**  
   In `tests/api/valuesets.filled.test.ts`, for the test `returns same payload shape with datasheet.subsheets and fields`, set a per-test timeout (e.g. `10000` ms) via the third argument to `it(...)`. Document in a one-line comment that the test loads the real filledSheetService and can be slow under parallel run.

2. **Optional: describe-level timeout**  
   If other tests in the same describe ever time out, add a `jest.setTimeout(10000)` (or similar) at the top of the describe “GET filled sheet (same payload shape)” and a short comment.

3. **No change to test logic or mocks**  
   The test behavior and expectations are correct; only the timeout limit is insufficient under full-suite runs.

**Tests to update:** Only the one `it('returns same payload shape...')` in `tests/api/valuesets.filled.test.ts` (add timeout and optional comment). No assertion or mock changes.

**Verification:**  
- `npx jest tests/api/valuesets.filled.test.ts --no-cache` — should still pass.  
- Run full suite (e.g. `npm test`) and confirm valuesets.filled no longer reports a timeout.

---

## Summary

| Suite | Cause | Minimal fix |
|-------|--------|-------------|
| filledAttachments.delete.canonicalFirst | Missing mock for `bumpRejectedToModifiedDraftFilled`; wrong `deleteAttachmentById` call arity in assertion | Add mock; fix assertion to `(123, 555, 1)`. |
| valuesets.filled | Test exceeds default 5 s timeout when run in full suite (module load / parallelism) | Increase timeout for the “returns same payload shape…” test (e.g. 10 s). |

No schema changes, no behavioral changes to production code; only test-only updates as above.
