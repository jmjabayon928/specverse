# Template Structure Editing — Local Build & Manual E2E Checklist

**Purpose:** Final confirmation that Template Structure Editing is shippable before merge.

---

## 1. PowerShell commands to run locally

### Build

```powershell
cd c:\projects\specverse
npm run build
```

**If build fails:** Capture full output (no guessing):

```powershell
cd c:\projects\specverse
npm run build 2>&1 | Tee-Object -FilePath build-output.txt
```

Then open `build-output.txt` for the full log. For Next.js build errors, the last 80–100 lines usually show the failing file and error; TypeScript/ESLint errors appear earlier in the stream.

Optional (verbose):

```powershell
$env:DEBUG = "*"; npm run build 2>&1 | Tee-Object -FilePath build-output.txt
```

---

## 2. Manual verification checklist: `/datasheets/templates/[id]/edit`

Use a template in **Draft**, **Modified Draft**, or **Rejected** status where you are the creator (PreparedBy). Replace `[id]` with a real template ID.

| # | Action | Expected result | Pass? |
|---|--------|-----------------|-------|
| 1 | **Add subsheet** | Click “Add Subsheet”. New subsheet appears with default name “New Subsheet”. No console/network error. | ☐ |
| 2 | **Rename subsheet** | Change subsheet name in the text input. Blur or move focus. Name persists (no error toast). | ☐ |
| 3 | **Reorder subsheets** | Use Move Up / Move Down on a subsheet. Order changes. **Refresh the page.** Subsheets appear in the new order (order persisted). | ☐ |
| 4 | **Add field with options** | In a subsheet, click “Add Field”. Set label, type, UOM, “Allowed Values” (e.g. `A, B, C`), Required. Field appears. No error. | ☐ |
| 5 | **Edit field options** | Change “Allowed Values” for an existing field (e.g. to `X, Y, Z`). Blur. **Refresh.** Options show as new values (old options replaced). | ☐ |
| 6 | **Reorder fields** | Use Move Up / Move Down on a field. **Refresh.** Fields appear in the new order (order persisted). | ☐ |
| 7 | **Delete field** | Click delete (trash) on a field. Field disappears from list. No error. | ☐ |
| 8 | **Delete subsheet** | Click delete (trash) on a subsheet. Confirmation modal appears: “This will delete the subsheet and all fields inside it. This cannot be undone.” Cancel closes modal. Confirm Delete: subsheet and all its fields removed; success toast “Subsheet deleted”. | ☐ |
| 9 | **Verified/Approved template** | Open a template in **Verified** or **Approved** status (or change status to Verified/Approved). Go to `/datasheets/templates/[id]/edit`. Either: (a) Edit button is hidden on detail page (TemplateActions), or (b) If you open edit URL directly: structure API calls return **409** and UI shows error messaging (e.g. toast or form error). No structure changes persisted. | ☐ |

**Pass condition:** All 9 items checked. If any fail, fix before merge.

---

## 2a. E2E run results (fill after manual run)

Run the checklist in §2 on a real Draft/Rejected template. Record pass/fail and any notes below.

| # | Action | Pass? | Notes |
|---|--------|-------|-------|
| 1 | Add subsheet | ☐ | |
| 2 | Rename subsheet | ☐ | |
| 3 | Reorder subsheets | ☐ | |
| 4 | Add field with options | ☐ | |
| 5 | Edit field options (replace) | ☐ | |
| 6 | Reorder fields | ☐ | |
| 7 | Delete field | ☐ | |
| 8 | Delete subsheet (confirm cascade + toast) | ☐ | |
| 9 | Verified/Approved template (409 UI + API) | ☐ | |

| Field | Value |
|-------|-------|
| **Run date** | __________ (YYYY-MM-DD) |
| **Template ID used** | __________ |
| **All passed** | ☐ Yes  ☐ No |

---

## 3. Route collision risks: `templateRoutes.ts`

**Express behavior:** Routes are matched in **registration order** and by **method + path**. The first matching route wins.

**Relevant order in `templateRoutes.ts`:**

1. **Fixed paths** (no param): `GET /`, `GET /reference-options`, `GET /note-types`, `GET /check-tag`.
2. **Structure routes** (all use `/:id/subsheets/...` or `/:id/subsheets/:subId/fields/...`):
   - `PUT /:id/subsheets/order`
   - `POST /:id/subsheets`
   - `PATCH /:id/subsheets/:subId`
   - `DELETE /:id/subsheets/:subId`
   - `POST /:id/subsheets/:subId/fields`
   - `PUT /:id/subsheets/:subId/fields/order`
   - `PATCH /:id/subsheets/:subId/fields/:fieldId`
   - `DELETE /:id/subsheets/:subId/fields/:fieldId`
3. **Then:** `GET /:id` (template details by ID).
4. **Then:** `GET /:sheetId/structure`, `PUT /:id`, `POST /:id/clone`, etc.

**Collision analysis:**

- **GET /:id** matches only **GET** and **one** path segment (e.g. `GET /5`).  
  So `GET /5/subsheets`, `GET /5/structure`, etc. are **not** matched by `GET /:id` (they have two or more segments). **No collision.**
- **Structure routes** use **PUT/POST/PATCH/DELETE** and paths with two or more segments. They are registered **before** `GET /:id`, so:
  - `PUT /5/subsheets/order` → `PUT /:id/subsheets/order` (id=5).
  - `GET /5` → later matches `GET /:id` (id=5).

**Conclusion:** Ordering is correct. New structure routes are **not** swallowed by `GET /:id`. No route collision risks identified.

---

## 4. Stop condition: READY TO MERGE

**If and only if:**

1. **Local build is green:** `npm run build` exits with code 0.
2. **Checklist passes:** All 9 manual verification items above are checked.

**Then output:**

---

**READY TO MERGE**

**Final commits (log):**

Run locally to list commits for this feature:

```powershell
cd c:\projects\specverse
git log --oneline -20
```

Use the commit range that corresponds to “Template Structure Editing” (e.g. from “Add template structure editing” or “Template structure API” through the latest hardening/checklist commit). Example:

- `abc1234 Template structure editing: bulk field reorder + guard hardening + e2e checklist`
- `def5678 Template structure editing: subsheet + field CRUD, lifecycle gating, tests`
- (and any prior commits in the same feature branch)

---

**If build fails or any checklist item fails:** Do **not** merge; fix the failure and re-run build and checklist until both are green.
