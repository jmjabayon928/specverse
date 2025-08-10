// src/backend/utils/auditDiffs.ts
import { sql } from "@/backend/config/db";
import type { Transaction } from "mssql";
import type { UnifiedSheet } from "@/types/sheet";

// ---------------- types just for diffing ----------------
export type NormOption = string;

export type NormField = {
  key: string;
  originalId?: number;
  label: string;
  infoType: string;
  uom?: string | null;
  required: boolean;
  order: number;
  options: NormOption[];
};

export type NormSub = {
  key: string;
  originalId?: number;
  name: string;
  order: number;
  fields: NormField[];
};

export type NormTemplate = {
  subs: NormSub[];
};

// Prefer matching by originalId; fall back to a normalized name/label
function subKey(originalId?: number, name?: string) {
  return typeof originalId === "number"
    ? `sub#${originalId}`
    : `name:${(name ?? "").toLowerCase()}`;
}
function fieldKey(originalId?: number, label?: string) {
  return typeof originalId === "number"
    ? `fld#${originalId}`
    : `label:${(label ?? "").toLowerCase()}`;
}

// ---------------- fetch "before" (current DB) ----------------
export async function fetchCurrentTemplateStructure(
  tx: Transaction,
  sheetId: number
): Promise<NormTemplate> {
  const subsRes = await tx
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query<{ SubID: number; SubName: string; OrderIndex: number }>(`
      SELECT s.SubID, s.SubName, s.OrderIndex
      FROM dbo.SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, s.SubID
    `);

  const fieldsRes = await tx
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query<{
      InfoTemplateID: number;
      SubID: number;
      Label: string;
      InfoType: string;
      OrderIndex: number;
      UOM: string | null;
      Required: boolean | number;
    }>(`
      SELECT it.InfoTemplateID, it.SubID, it.Label, it.InfoType, it.OrderIndex, it.UOM, it.Required
      FROM dbo.InformationTemplates it
      INNER JOIN dbo.SubSheets s ON s.SubID = it.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY it.OrderIndex, it.InfoTemplateID
    `);

  const optsRes = await tx
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query<{ InfoTemplateID: number; OptionValue: string; SortOrder: number }>(`
      SELECT ito.InfoTemplateID, ito.OptionValue, ito.SortOrder
      FROM dbo.InformationTemplateOptions ito
      INNER JOIN dbo.InformationTemplates it ON it.InfoTemplateID = ito.InfoTemplateID
      INNER JOIN dbo.SubSheets s ON s.SubID = it.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY ito.SortOrder, ito.InfoTemplateID
    `);

  const subsById = new Map<number, NormSub>();
  for (const s of subsRes.recordset) {
    subsById.set(s.SubID, {
      key: subKey(s.SubID, s.SubName),
      originalId: s.SubID,
      name: s.SubName,
      order: s.OrderIndex,
      fields: [],
    });
  }

  const optionsByInfoId = new Map<number, string[]>();
  for (const o of optsRes.recordset) {
    if (!optionsByInfoId.has(o.InfoTemplateID)) {
      optionsByInfoId.set(o.InfoTemplateID, []);
    }
    optionsByInfoId.get(o.InfoTemplateID)!.push(o.OptionValue);
  }

  for (const f of fieldsRes.recordset) {
    const sub = subsById.get(f.SubID);
    if (!sub) continue;
    sub.fields.push({
      key: fieldKey(f.InfoTemplateID, f.Label),
      originalId: f.InfoTemplateID,
      label: f.Label,
      infoType: f.InfoType,
      uom: f.UOM ?? null,
      required: typeof f.Required === "boolean" ? f.Required : f.Required === 1,
      order: f.OrderIndex,
      options: optionsByInfoId.get(f.InfoTemplateID) ?? [],
    });
  }

  const subs: NormSub[] = Array.from(subsById.values()).sort(
    (a, b) => a.order - b.order || (a.originalId! - b.originalId!)
  );
  for (const s of subs) {
    s.fields.sort(
      (a, b) => a.order - b.order || (a.originalId! - b.originalId!)
    );
  }

  return { subs };
}

// ---------------- normalize incoming UnifiedSheet ----------------
export function normalizeIncoming(data: UnifiedSheet): NormTemplate {
  const subs: NormSub[] = (data.subsheets ?? []).map((s, si) => ({
    key: subKey(s.originalId, s.name),
    originalId: s.originalId,
    name: s.name,
    order: si, // array index
    fields: (s.fields ?? []).map((f, fi) => ({
      key: fieldKey(f.originalId, f.label),
      originalId: f.originalId,
      label: f.label,
      infoType: f.infoType,
      uom: f.uom ?? null,
      required: !!f.required,
      order: fi, // array index
      options: Array.isArray(f.options) ? [...f.options] : [],
    })),
  }));

  return { subs };
}

// ---------------- diff "before" vs "after" ----------------
export function diffTemplateStructure(
  before: NormTemplate,
  after: NormTemplate
): string[] {
  const messages: string[] = [];

  const bSubs = new Map(before.subs.map((s) => [s.key, s]));
  const aSubs = new Map(after.subs.map((s) => [s.key, s]));

  for (const [k, b] of bSubs) {
    if (!aSubs.has(k)) messages.push(`Subsheet removed: "${b.name}"`);
  }
  for (const [k, a] of aSubs) {
    if (!bSubs.has(k)) messages.push(`Subsheet added: "${a.name}"`);
  }

  for (const [k, b] of bSubs) {
    const a = aSubs.get(k);
    if (!a) continue;

    if (a.name !== b.name) {
      messages.push(`Subsheet renamed: "${b.name}" → "${a.name}"`);
    }

    const bFields = new Map(b.fields.map((f) => [f.key, f]));
    const aFields = new Map(a.fields.map((f) => [f.key, f]));

    for (const [fk, bf] of bFields) {
      if (!aFields.has(fk)) {
        messages.push(`Field removed in "${b.name}": "${bf.label}"`);
      }
    }
    for (const [fk, af] of aFields) {
      if (!bFields.has(fk)) {
        messages.push(`Field added in "${a.name}": "${af.label}"`);
      }
    }
    for (const [fk, bf] of bFields) {
      const af = aFields.get(fk);
      if (!af) continue;

      if (af.label !== bf.label) {
        messages.push(
          `Field renamed in "${a.name}": "${bf.label}" → "${af.label}"`
        );
      }
      if (af.infoType !== bf.infoType) {
        messages.push(
          `Field type changed in "${a.name}" ["${af.label}"]: ${bf.infoType} → ${af.infoType}`
        );
      }
      const bU = bf.uom ?? "";
      const aU = af.uom ?? "";
      if (aU !== bU) {
        messages.push(
          `Field UOM changed in "${a.name}" ["${af.label}"]: ${
            bU || "—"
          } → ${aU || "—"}`
        );
      }
      if (af.required !== bf.required) {
        messages.push(
          `Field required toggled in "${a.name}" ["${af.label}"]: ${
            bf.required ? "Yes" : "No"
          } → ${af.required ? "Yes" : "No"}`
        );
      }
      const bSet = new Set(bf.options ?? []);
      const aSet = new Set(af.options ?? []);
      const added: string[] = [];
      const removed: string[] = [];
      for (const opt of aSet) if (!bSet.has(opt)) added.push(opt);
      for (const opt of bSet) if (!aSet.has(opt)) removed.push(opt);
      if (added.length || removed.length) {
        if (added.length)
          messages.push(
            `Field options added in "${a.name}" ["${af.label}"]: ${added.join(
              ", "
            )}`
          );
        if (removed.length)
          messages.push(
            `Field options removed in "${a.name}" ["${af.label}"]: ${removed.join(
              ", "
            )}`
          );
      }
    }
  }

  return messages;
}
