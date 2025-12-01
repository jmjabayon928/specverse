// src/backend/services/i18n/TranslationService.ts
import {
  TranslateRequest,
  TranslationResult,
  TranslationProvider,
  LangTag,
} from "./types";
import {
  upsertInfoTemplateTranslation,
  upsertSheetTranslation,
  upsertSubsheetTranslation,
} from "./upserts";

const CHUNK_SIZE = 200; // defensive batching in case providers limit payload size

export class TranslationService {
  constructor(private readonly provider: TranslationProvider) {}

  public async translateAndSave(req: TranslateRequest): Promise<TranslationResult[]> {
    const { sourceLang, targets, items } = req;

    // Build [label, value?, label, value?, ...] preserving order
    const textPack = packTexts(items);

    const results: TranslationResult[] = [];
    for (const targetLang of targets) {
      // 1) Translate
      const translated = await this.translateAll(sourceLang, targetLang, textPack);

      // 2) Re-zip into per-item pairs
      const perItem = rezipPairs(items.length, translated);

      // 3) Persist & build result payload
      const saved = await this.persistPairs(items, perItem, sourceLang, targetLang);

      results.push({
        targetLang,
        items: saved,
      });
    }

    return results;
  }

  /* --------------------------- internals --------------------------- */

  private async translateAll(
    sourceLang: LangTag,
    targetLang: LangTag,
    texts: string[]
  ): Promise<string[]> {
    if (texts.length === 0) return [];

    // Batch to avoid provider hard-limits
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      // Provider must return an array with the same length
      // If a provider misbehaves, fall back to original texts for that chunk
      // to keep length invariant and avoid crashes.
      const translated = await this.provider.translateBulk({
        sourceLang,
        targetLang,
        texts: chunk,
      });

      if (!Array.isArray(translated) || translated.length !== chunk.length) {
        out.push(...chunk); // safe fallback: copy originals
      } else {
        out.push(...translated);
      }
    }
    return out;
  }

  private async persistPairs(
    items: TranslateRequest["items"],
    pairs: Array<{ labelTranslated: string; valueTranslated?: string }>,
    sourceLang: LangTag,
    targetLang: LangTag
  ): Promise<TranslationResult["items"]> {
    const out: TranslationResult["items"] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const pair = pairs[idx];

      // Persist per entity type
      await this.upsert(item.entity, {
        id: item.id,
        lang: targetLang,
        label: pair.labelTranslated,
        sourceLanguage: sourceLang,
      });

      out.push({
        entity: item.entity,
        id: item.id,
        labelTranslated: pair.labelTranslated,
        valueTranslated: item.value ? pair.valueTranslated : undefined,
        isMachineTranslated: true,
      });
    }

    return out;
  }

  private async upsert(
    entity: "sheet" | "subsheet" | "infoTemplate",
    input: {
      id: number;
      lang: LangTag;
      label: string;
      sourceLanguage: LangTag;
    }
  ): Promise<void> {
    if (entity === "infoTemplate") {
      await upsertInfoTemplateTranslation({
        infoTemplateId: input.id,
        lang: input.lang,
        label: input.label,
        sourceLanguage: input.sourceLanguage,
        isMachineTranslated: true,
      });
      return;
    }

    if (entity === "sheet") {
      await upsertSheetTranslation({
        sheetId: input.id,
        lang: input.lang,
        label: input.label,
        sourceLanguage: input.sourceLanguage,
        isMachineTranslated: true,
      });
      return;
    }

    // subsheet
    await upsertSubsheetTranslation({
      subsheetId: input.id,
      lang: input.lang,
      label: input.label,
      sourceLanguage: input.sourceLanguage,
      isMachineTranslated: true,
    });
  }
}

/* ------------------------- small utilities ------------------------- */

function packTexts(
  items: TranslateRequest["items"]
): string[] {
  // For each item, we push [label, value-or-empty] to keep even length.
  const out: string[] = [];
  for (const i of items) {
    out.push(i.label, i.value ?? "");
  }
  return out;
}

function rezipPairs(
  itemCount: number,
  translated: string[]
): Array<{ labelTranslated: string; valueTranslated?: string }> {
  const out: Array<{ labelTranslated: string; valueTranslated?: string }> = [];
  for (let idx = 0; idx < itemCount; idx++) {
    const labelTranslated = translated[idx * 2] ?? "";
    const valueTranslated = translated[idx * 2 + 1] ?? "";
    out.push({
      labelTranslated,
      valueTranslated: valueTranslated || undefined,
    });
  }
  return out;
}
