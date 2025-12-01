// src/backend/services/i18n/upserts.ts
import { poolPromise, sql } from "@/backend/config/db";
import { LangTag } from "./types";

/* ----------------------------- public API ----------------------------- */

export async function upsertInfoTemplateTranslation(input: {
  infoTemplateId: number;
  lang: LangTag;
  label: string;
  sourceLanguage: LangTag;
  isMachineTranslated: boolean;
}): Promise<void> {
  await executeMerge({
    table: "dbo.InfoTemplateTranslations",
    keyCols: { InfoTemplateID: input.infoTemplateId, Lang: input.lang },
    updateCols: {
      Label: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
    insertCols: {
      InfoTemplateID: input.infoTemplateId,
      Lang: input.lang,
      Label: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
  });
}

export async function upsertSheetTranslation(input: {
  sheetId: number;
  lang: LangTag;
  label: string; // maps to SheetName
  sourceLanguage: LangTag;
  isMachineTranslated: boolean;
}): Promise<void> {
  await executeMerge({
    table: "dbo.SheetTranslations",
    keyCols: { SheetID: input.sheetId, Lang: input.lang },
    updateCols: {
      SheetName: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
    insertCols: {
      SheetID: input.sheetId,
      Lang: input.lang,
      SheetName: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
  });
}

export async function upsertSubsheetTranslation(input: {
  subsheetId: number;
  lang: LangTag;
  label: string; // maps to SubsheetName
  sourceLanguage: LangTag;
  isMachineTranslated: boolean;
}): Promise<void> {
  await executeMerge({
    table: "dbo.SubsheetTranslations",
    keyCols: { SubsheetID: input.subsheetId, Lang: input.lang },
    updateCols: {
      SubsheetName: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
    insertCols: {
      SubsheetID: input.subsheetId,
      Lang: input.lang,
      SubsheetName: input.label,
      SourceLanguage: input.sourceLanguage,
      IsMachineTranslated: input.isMachineTranslated,
    },
  });
}

/* ----------------------------- internals ----------------------------- */

type Primitive = string | number | boolean;

interface MergeSpec {
  table: string;
  keyCols: Record<string, Primitive>;
  updateCols: Record<string, Primitive>;
  insertCols: Record<string, Primitive>;
}

async function executeMerge(spec: MergeSpec): Promise<void> {
  const pool = await poolPromise;

  const params = collectParams(spec);

  const keyColNames = Object.keys(spec.keyCols);
  const updateColNames = Object.keys(spec.updateCols);
  const insertColNames = Object.keys(spec.insertCols);

  const usingSelect = keyColNames.map((k) => `@${k} AS ${k}`).join(", ");
  const onClause = keyColNames.map((k) => `target.${k} = src.${k}`).join(" AND ");

  const updateSet = [
    ...updateColNames.map((c) => `${c} = @${c}`),
    "UpdatedAt = SYSUTCDATETIME()",
  ].join(", ");

  const insertCols = [...insertColNames, "CreatedAt", "UpdatedAt"].join(", ");
  const insertValues = [
    ...insertColNames.map((c) => `@${c}`),
    "SYSUTCDATETIME()",
    "SYSUTCDATETIME()",
  ].join(", ");

  const query = `
MERGE ${spec.table} AS target
USING (SELECT ${usingSelect}) AS src
ON (${onClause})
WHEN MATCHED THEN UPDATE SET ${updateSet}
WHEN NOT MATCHED THEN INSERT (${insertCols})
VALUES (${insertValues});
`;

  const req = pool.request();

  // Guarded union handling: strings get explicit NVARCHAR(MAX); others infer type
  for (const p of params) {
    if ("type" in p) {
      req.input(p.name, p.type, p.value); // string branch
    } else {
      req.input(p.name, p.value); // number/boolean branches
    }
  }

  await req.query(query);
}

/* ----------------------------- utils ----------------------------- */

type InputParam =
  | { name: string; value: string; type: sql.ISqlType } // strings → explicit NVARCHAR(MAX)
  | { name: string; value: number }                     // infer numeric
  | { name: string; value: boolean };                   // infer bit

function collectParams(spec: MergeSpec): InputParam[] {
  const merged = new Map<string, Primitive>();
  for (const [k, v] of Object.entries(spec.keyCols)) merged.set(k, v);
  for (const [k, v] of Object.entries(spec.updateCols)) merged.set(k, v);
  for (const [k, v] of Object.entries(spec.insertCols)) merged.set(k, v);

  const params: InputParam[] = [];
  merged.forEach((value, name) => {
    if (typeof value === "string") {
      params.push({ name, value, type: sql.NVarChar(sql.MAX) });
    } else if (typeof value === "number") {
      params.push({ name, value });
    } else {
      params.push({ name, value });
    }
  });

  return params;
}
