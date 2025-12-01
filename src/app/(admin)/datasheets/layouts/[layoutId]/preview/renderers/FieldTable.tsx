/**
 * SpecVerse Preview (refactor split) — Performance-safe
 * Strict TypeScript, no `any`. Pure functions + small components.
 * This file is part of: /datasheets/layouts/[layoutId]/preview
 */

// renderers/FieldTable.tsx
"use client";
import React from "react";
import { GroupedRow } from "../groupFields";

export const FieldTable: React.FC<Readonly<{ rows: ReadonlyArray<GroupedRow> }>> = ({ rows }) => {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => {
          if (r.kind === "single") {
            const f = r.field;
            return (
              <tr key={`single-${f.infoTemplateId}`} className="border-b last:border-b-0">
                <td className="py-2 pr-4 align-top w-1/2">
                  <span className="font-medium">{f.label}</span>
                  {f.uom ? <span className="ml-1 text-muted-foreground">({f.uom})</span> : null}
                </td>
                <td className="py-2 align-top">{f.value ? <span>{f.value}</span> : <span className="text-muted-foreground">no value</span>}</td>
              </tr>
            );
          }
          return (
            <tr key={`group-${r.label}-${r.cells.map(c=>c.key).join("-")}`} className="border-b last:border-b-0">
              <td className="py-2 pr-4 align-top w-1/2">
                <span className="font-medium">{r.label}</span>
                {r.uom ? <span className="ml-1 text-muted-foreground">({r.uom})</span> : null}
              </td>
              <td className="py-2 align-top">
                <div className="grid grid-cols-3 gap-2">
                  {r.cells.map((c) => (
                    <div key={c.key} className="flex items-baseline gap-2">
                      {c.caption ? <span className="text-muted-foreground">{c.caption}:</span> : null}
                      {c.value ? <span>{c.value}</span> : <span className="text-muted-foreground">no value</span>}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
