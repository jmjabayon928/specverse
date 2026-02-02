# Filled sheet create validation debug (templateId=1239)

## To-do: confirm fix in real app

1. **Run backend with debug:** `setx SPECVERSE_DEBUG_FILLED_VALIDATE 1` then restart backend.
2. **In browser:** Open `/datasheets/filled/create?templateId=1239`, submit with:
   - Decimals: **2** and **2** (or 2.0)
   - Options: **A** and **D**
3. **If it still returns 400:** Paste the backend `[FILLED_VALIDATE]` logs and the exact request payload `fieldValues` (from DevTools) into the sections below.
4. **If it succeeds:** Turn off env: `setx SPECVERSE_DEBUG_FILLED_VALIDATE ""`. Add a short “✅ verified in UI” note below including timestamp and templateId.

---

## If it still returns 400

Paste backend `[FILLED_VALIDATE]` logs for IDs 3792, 3795, 3796, 3797:

```
(paste [FILLED_VALIDATE] lines here)
```

Paste the exact request payload `fieldValues` object (from DevTools Network → request payload):

```
(paste fieldValues object here)
```

---

## If it succeeds

Turn off: `setx SPECVERSE_DEBUG_FILLED_VALIDATE ""`

Add note:

```
✅ verified in UI — (timestamp, e.g. 2025-02-01 14:30 UTC), templateId=1239
```

---

## Hard rule (implemented)

Create validation resolves values with **fieldValues[String(infoTemplateId)]** as the primary/authoritative source. OrderIndex is not used for value lookup. Legacy lookups (field.id / field.originalId) are fallback only and must never override the string-key payload value.

## Audit: other reads of fieldValues / value map

- **buildValuesKeyedByTemplateId** — single source for the map passed to validation; uses `data.fieldValues[String(row.InfoTemplateID)]` as primary.
- **validateFilledValues** — receives `valuesKeyedByTemplateId` and uses `values[String(infoTemplateId)]`; no rebuild.
- **cloneSubsheetsAndFields** — after validation, reads `data.fieldValues[String(originalId)]` where `originalId` is `field.id` (InfoTemplateID). No OrderIndex. No other value rebuild.
