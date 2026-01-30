# Templates API mock shape audit

Audit of mocked `templateService` return shapes in `tests/api/datasheets.templates.test.ts` vs controller/handler expectations. No production code changes; test-only.

---

## 1. POST /api/backend/templates

**Handler:** `createTemplateHandler` (templateController.ts)

- Calls: `const newId = await createTemplate(payload, user.userId)`
- Response: `res.status(201).json({ sheetId: newId })`

**Observed contract:** `createTemplate(data, userId)` returns `Promise<number>` (the new sheet ID). The controller builds the response body as `{ sheetId: newId }`; it does not expect a DTO from the service.

**Mock:** `createTemplate: jest.fn().mockResolvedValue(1)`

**Result:** Mock matches. Controller expects a number; mock returns `1`. Response body is `{ sheetId: 1 }`.

---

## 2. GET /api/backend/templates/:id

**Handler:** `getTemplateById`

- Calls: `const data = await getTemplateDetailsById(templateId, lang)`
- Response: `res.status(200).json(data)`

**Observed contract:** `getTemplateDetailsById(templateId, lang?, uom?)` returns `Promise<{ datasheet: UnifiedSheet; translations: unknown } | null>` (templateService.ts). The controller sends this object as-is; the response body must have `datasheet` (and optionally `translations`) for client assertions.

**Mock:** Returns `{ datasheet: { sheetId, disciplineId, disciplineName, subtypeId, subtypeName }, translations: null }` keyed by `templateId`.

**Result:** Mock matches. Shape is `{ datasheet, translations }`; controller does `res.json(data)` so the client receives that shape.

---

## 3. PUT /api/backend/templates/:id

**Handler:** `updateTemplateHandler`

- Calls: `const updatedId = await updateTemplate(sheetId, payload, user.userId)`
- Response: `res.status(200).json({ sheetId: updatedId })`

**Observed contract:** `updateTemplate(sheetId, data, userId)` returns `Promise<number>` (templateService.ts). The controller uses that number as `sheetId` in the response.

**Mock:** `updateTemplate: jest.fn().mockImplementation((sheetId: number) => Promise.resolve(sheetId))`

**Result:** Mock matches. Controller expects a number; mock returns the same `sheetId` passed in. Response body is `{ sheetId: <id> }`.

---

## 4. POST /api/backend/templates/:id/verify

**Handler:** `verifyTemplateHandler`

- Calls: `await verifyTemplate(sheetId, action, rejectionComment, userId)`
- Response: `res.status(200).json({ sheetId, action, rejectionComment })`

**Observed contract:** `verifyTemplate(sheetId, action, rejectionComment, verifiedById)` returns `Promise<void>` (templateService.ts). The controller does not use the return value; it builds the response from the request params and body.

**Mock:** `verifyTemplate: jest.fn().mockResolvedValue(undefined)`

**Result:** Mock matches. Return value is unused; `undefined` is correct for `Promise<void>`.

---

## Summary

| Service function           | Observed return type                    | Mock return                    | Match |
|---------------------------|----------------------------------------|--------------------------------|-------|
| `createTemplate`          | `Promise<number>`                      | `1`                            | Yes   |
| `getTemplateDetailsById`  | `Promise<{ datasheet; translations } \| null>` | `{ datasheet, translations: null }` | Yes   |
| `updateTemplate`          | `Promise<number>`                     | `sheetId` (same as arg)        | Yes   |
| `verifyTemplate`          | `Promise<void>`                        | `undefined`                    | Yes   |

**Test-only adjustments made:** None. All four mocks already matched the controller contract.

**Verification:** `npx jest tests/api/datasheets.templates.test.ts --runInBand --no-cache` — suite passes with these mock shapes.
