"use client";

import * as React from "react";
import type { RenderField } from "../groupFields";

/* ----------------------------- Types ----------------------------- */

export type CaseMatrixConfig = Readonly<{
  kind: "caseMatrix";
  columns: Readonly<{
    cases: readonly string[];           // e.g., ["Min", "Norm.", "Max"] or ["Rated", "Design"]
    includeUnits?: boolean;             // default: true
    includeRemarks?: boolean;           // default: false (wire later if you model remarks)
  }>;
}>;

type Props = Readonly<{
  subsheetName: string;
  config: CaseMatrixConfig;
  fields: ReadonlyArray<RenderField>;
}>;

/* --------------------------- Utilities --------------------------- */

function normToken(raw: string): string {
  return raw.toLowerCase().replaceAll(/[.\s]/g, "");
}

function buildIndex(cases: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  let i = 0;
  for (const c of cases) m.set(normToken(c), i++);
  return m;
}

function extractSuffix(label: string): { base: string; suffix: string } | null {
  const m = /(.*)\(([^)]+)\)\s*$/.exec(label.trim());
  if (!m) return null;
  const base = (m[1] ?? "").trim();
  const suffix = (m[2] ?? "").trim();
  if (!base || !suffix) return null;
  return { base, suffix };
}

/* ----------------------------- View ------------------------------ */

export function CaseMatrixSection(props: Props) {
  const { subsheetName, config, fields } = props;
  const cases = config.columns.cases;
  const includeUnits = config.columns.includeUnits !== false;   // default true
  const includeRemarks = config.columns.includeRemarks === true; // default false

  const indexByCase = React.useMemo(() => buildIndex(cases), [cases]);

  type Row = {
    base: string;
    uom?: string;
    values: (string | undefined)[];
    remarks?: string;
  };

  const rows = React.useMemo<ReadonlyArray<Row>>(() => {
    const byBase = new Map<string, Row>();

    for (const f of fields) {
      const parsed = extractSuffix(f.label);
      if (!parsed) continue;

      const pos = indexByCase.get(normToken(parsed.suffix));
      if (pos == null) continue;

      let row = byBase.get(parsed.base);
      if (!row) {
        row = {
          base: parsed.base,
          uom: f.uom,
          values: new Array(cases.length).fill(undefined), // ← fixed: new Array(...)
        };
        byBase.set(parsed.base, row);
      }

      row.values[pos] = f.value ?? "";
      if (!row.uom && f.uom) row.uom = f.uom;
    }

    return Array.from(byBase.values());
  }, [fields, indexByCase, cases.length]);

  const tableHasRows = rows.length > 0;

  return (
    <section className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-semibold">{subsheetName}</div>

      {tableHasRows ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left font-semibold">Label</th>
                {includeUnits && <th className="px-2 py-1 text-left font-semibold">UOM</th>}
                {cases.map((c) => (
                  <th key={c} className="px-2 py-1 text-center font-semibold">
                    {c}
                  </th>
                ))}
                {includeRemarks && <th className="px-2 py-1 text-left font-semibold">Remarks</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.base} className="border-b">
                  <td className="px-2 py-1 align-top">{r.base}</td>
                  {includeUnits && <td className="px-2 py-1 align-top">{r.uom ?? ""}</td>}
                  {r.values.map((v, i) => (
                    <td key={`${r.base}-${i}`} className="px-2 py-1 text-center align-top">
                      {v ?? ""}
                    </td>
                  ))}
                  {includeRemarks && <td className="px-2 py-1 align-top">{r.remarks ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No matrix data found for this subsheet.</p>
      )}
    </section>
  );
}
