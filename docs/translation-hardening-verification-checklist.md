# Translation hardening verification checklist

Use this checklist to verify translation hardening in real flows (no new features). Prerequisite: DB has translation rows for the target locale where applicable (e.g. FR in `SheetTranslations`, `SubsheetTranslations`, `InfoTemplateTranslations`, `InfoOptionTranslations`).

---

## 1. Template detail `?lang=fr` shows translated labels (if DB has FR)

- [ ] Open a template detail page with `?lang=fr` (e.g. `/datasheets/templates/[id]?lang=fr`).
- [ ] If the template has French rows in `SheetTranslations` / `SubsheetTranslations` / `InfoTemplateTranslations`: sheet name, subsheet names, and field labels show in French.
- [ ] If no French rows: labels show in English (fallback); no crash, no raw keys.
- [ ] UI chrome (e.g. "Template", status "Draft"/"Verified") uses French from `constants/translations` when key exists.

---

## 2. Filled detail `?lang=fr` shows translated labels (if DB has FR)

- [ ] Open a filled sheet detail page with `?lang=fr` (e.g. `/datasheets/filled/[id]?lang=fr`).
- [ ] If the template has French translations: sheet name, subsheet names, field labels, and option values show in French.
- [ ] If no French rows: labels show in English (fallback); no crash.
- [ ] Changing language (e.g. via context selector) refetches and updates labels; switching back to initial language uses server-passed `initialTranslations` (no unnecessary refetch).

---

## 3. Layout render `lang=en` and `lang=eng` both 200

- [ ] `GET /api/backend/layouts/[layoutId]/render?sheetId=[id]&uom=SI&lang=en` with valid auth returns **200**.
- [ ] `GET /api/backend/layouts/[layoutId]/render?sheetId=[id]&uom=SI&lang=eng` with valid auth returns **200**.
- [ ] Response payload is the same shape; `lang` in payload is normalized (e.g. `eng`).

---

## 4. Layout render `lang=fr` uses translated label when translation exists

- [ ] Ensure `InfoTemplateTranslations` has at least one row for a field on the layout (e.g. `LangCode='fr'`, `InfoTemplateID` and `Label` set).
- [ ] `GET /api/backend/layouts/[layoutId]/render?sheetId=[id]&uom=SI&lang=fr` with valid auth returns **200**.
- [ ] Response `body` (or equivalent) contains a field whose `label` is the French value from `InfoTemplateTranslations`, not the English fallback.

---

## 5. Excel export headers localized in FR

- [ ] Export a filled sheet as Excel with `lang=fr` (e.g. download from filled detail with language set to French, or call export API with `?lang=fr`).
- [ ] First row of the datasheet worksheet uses French column headers (e.g. "Étiquette", "Unité", "Options", "Valeur") from `constants/translations`, not hardcoded English.
- [ ] Missing key or unsupported lang: header row falls back to key or English; no crash.

---

## Sign-off

| Item | Verified (Y/N) | Notes |
|------|----------------|--------|
| 1. Template detail ?lang=fr | | |
| 2. Filled detail ?lang=fr | | |
| 3. Layout render lang=en / lang=eng | | |
| 4. Layout render lang=fr translated label | | |
| 5. Excel export headers FR | | |
