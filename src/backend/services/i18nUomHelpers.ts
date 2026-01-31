// src/backend/services/i18nUomHelpers.ts

/**
 * i18n + UOM helpers for the Builder render pipeline.
 * - Reuses src/utils conversion utilities
 * - Strict TS (no `any`)
 * - Uses RegExp.exec instead of .match()
 * - No nested ternaries
 * - Provides a small in-memory cache for translated labels, with a
 *   one-shot priming API you can call from the service layer.
 */

import type { UomSystem } from "@/domain/layouts/layoutTypes";
import { normalizeUnit } from "@/utils/unitKinds";
import {
  convertToUSC as tableConvertToUSC,
  convertToSI as tableConvertToSI,
  getUSCUnit as tableGetUSCUnit,
  getSIUnit as tableGetSIUnit,
} from "@/utils/unitConversionTable";

import { ConnectionPool, Int, NVarChar } from "mssql";
import type { Request, IResult } from "mssql";
import { poolPromise } from "../config/db";

/* ============================================================================
 * Public types
 * ========================================================================== */

export type LangCode = "en" | "eng";

/* ============================================================================
 * Parsing & number formatting
 * ========================================================================== */

/**
 * Parses a numeric string safely. Accepts:
 *  - integers / decimals
 *  - optional leading sign
 *  - optional thousands separators (commas or spaces) between groups
 * Returns `number | null`.
 */
function parseNumeric(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Remove thousands separators between digit groups (e.g., 1,234 or 1 234)
  const cleaned = trimmed.replaceAll(/(?<=\d)[, ](?=\d{3}\b)/g, "");

  // Accept forms like -12, 12.34, +0.5, .75
  const re = /^[+-]?(?:\d+|\d+\.\d+|\.\d+)$/;
  const m = re.exec(cleaned);
  if (!m) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatNumber(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  if (decimals === 0) return fixed;
  // trim trailing zeros while preserving one decimal point only when needed
  const trimmed = fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.$/u, "");
  return trimmed;
}

function applyCustomDecimalsIfNeeded(valueStr: string, decimals?: number): string {
  if (typeof decimals !== "number") return valueStr;
  const n = parseNumeric(valueStr);
  if (n === null) return valueStr;
  return formatNumber(n, decimals);
}

/* ============================================================================
 * Unit normalization & conversion wrappers
 * ========================================================================== */

/**
 * Additional normalization on top of `normalizeUnit` for common aliases.
 * Example: "degC" -> "°C", "m3" -> "m³".
 */
function normalizeUom(uom?: string | null): string | undefined {
  if (!uom) return undefined;
  const base = normalizeUnit(uom).trim();
  if (base.length === 0) return undefined;

  if (base === "C") return "°C";
  if (base === "F") return "°F";
  if (base === "degC") return "°C";
  if (base === "degF") return "°F";
  if (base === "m3") return "m³";
  if (base === "ft3") return "ft³";

  return base;
}

/**
 * Returns the display UOM for the target system (SI/USC),
 * given the source UOM (may already be SI or USC).
 * If unknown, returns the original source unit as-is.
 */
export function getConvertedUOM(target: UomSystem, sourceUom?: string): string | undefined {
  const normalized = normalizeUom(sourceUom);
  if (!normalized) return undefined;

  if (target === "USC") {
    const usc = tableGetUSCUnit(normalized);
    return usc || sourceUom;
  }

  // target SI
  const si = tableGetSIUnit(normalized);
  return si || sourceUom;
}

/**
 * Converts and formats a value string for display.
 * - If numeric and unit recognized, converts to the target system using your table helpers.
 * - If not numeric or unit unknown, returns the original `value` (optionally appending the unit).
 * - `includeUnit = true` returns "12.3 m", false returns "12.3".
 */
export function formatFieldValue(
  target: UomSystem,
  value: string,
  sourceUom?: string,
  includeUnit: boolean = true,
  customDecimals?: number
): string {
  const unitNorm = sourceUom ? normalizeUom(sourceUom) : "";

  // If no unit or non-numeric → return as-is (with unit if requested)
  const n = parseNumeric(value);
  if (!unitNorm || n === null) {
    if (!includeUnit || !sourceUom) return value;
    return `${value} ${sourceUom}`;
  }

  // Convert using your table helpers
  const converted = target === "USC"
    ? tableConvertToUSC(value, unitNorm)
    : tableConvertToSI(value, unitNorm);

  // Apply custom decimals if requested (post-conversion)
  const finalValue = applyCustomDecimalsIfNeeded(converted.value, customDecimals);

  if (!includeUnit) return finalValue;
  return converted.unit ? `${finalValue} ${converted.unit}` : finalValue;
}

/* ============================================================================
 * Label translation cache (DB-backed priming + sync getter)
 * ========================================================================== */

/** Cache key: `${lang}:${infoTemplateId}` */
const labelCache = new Map<string, string>();

function cacheKey(lang: LangCode, id: number): string {
  return `${lang}:${id}`;
}

type BindFn = (req: Request) => void;

/** Parameterized IN (...) helper for mssql */
function inClause(nameBase: string, values: number[]) {
  const paramNames: string[] = [];
  for (let i = 0; i < values.length; i += 1) {
    paramNames.push(`@${nameBase}${i}`);
  }
  const clause = paramNames.join(", ");
  const bind: BindFn = (req) => {
    let idx = 0;
    for (const v of values) {
      req.input(`${nameBase}${idx}`, Int, v);
      idx += 1;
    }
  };
  return { clause, bind };
}

/** Check if the translation table exists (no-op fallback if it doesn’t) */
async function translationsTableExists(pool: ConnectionPool): Promise<boolean> {
  const result: IResult<{ exists: number }> = await pool
    .request()
    .query(`
      SELECT CASE WHEN OBJECT_ID('dbo.InfoTemplateTranslations','U') IS NULL THEN 0 ELSE 1 END AS exists;
    `);
  return result.recordset[0]?.exists === 1;
}

/**
 * Prime the in-memory cache with labels for a set of template IDs.
 * Expected schema:
 *   dbo.InfoTemplateTranslations(
 *     InfoTemplateID int NOT NULL,
 *     LangCode       nvarchar(16) NOT NULL,
 *     Label          nvarchar(max) NOT NULL
 *   )
 * If the table doesn't exist (early rollout), this is a no-op.
 */
export async function primeTemplateLabelTranslations(
  templateIds: number[],
  lang: LangCode
): Promise<void> {
  if (lang === "en" || lang === "eng") return;  // base language uses fallback
  if (templateIds.length === 0) return;

  const pool = await poolPromise;
  const hasTable = await translationsTableExists(pool);
  if (!hasTable) return;

  // Filter out IDs already cached for this lang
  const missing: number[] = [];
  for (const id of templateIds) {
    if (!labelCache.has(cacheKey(lang, id))) {
      missing.push(id);
    }
  }
  if (missing.length === 0) return;

  const { clause, bind } = inClause("tpl", missing);

  const req = pool.request();
  req.input("lang", NVarChar(16), lang);
  bind(req);

  const rows: IResult<{ InfoTemplateID: number; Label: string }> = await req.query(`
    SELECT InfoTemplateID, Label
    FROM dbo.InfoTemplateTranslations WITH (NOLOCK)
    WHERE LangCode = @lang AND InfoTemplateID IN (${clause});
  `);

  for (const r of rows.recordset) {
    labelCache.set(cacheKey(lang, r.InfoTemplateID), r.Label);
  }
}

/**
 * Returns the translated label if it’s in the cache; otherwise falls back.
 * Keep this sync to make the render hot-path cheap—call
 * primeTemplateLabelTranslations([...], lang) beforehand.
 */
export function getTranslatedFieldLabel(
  infoTemplateId: number,
  fallback: string,
  lang: LangCode = "en"
): string {
  if (lang === "en" || lang === "eng" || infoTemplateId <= 0) return fallback;
  const k = cacheKey(lang, infoTemplateId);
  const cached = labelCache.get(k);
  return cached ?? fallback;
}
