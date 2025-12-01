"use client";

import * as React from "react";
import { FieldTable } from "./FieldTable";
import { applySubsheetLayout, type SubsheetSlotsConfig } from "../layout/applySubsheetLayout";
import type { RenderField, GroupedRow } from "../groupFields";

/* ----------------------------- Types & props ---------------------------- */

type Props = Readonly<{
  layoutId: number;
  subsheetId: number;
  subsheetName: string;
  fields: ReadonlyArray<RenderField>;
  config?: SubsheetSlotsConfig | null;
}>;

/* ------------------------------ UI helpers ------------------------------ */

function EmptyHint(props: Readonly<{ layoutId: number; subsheetId: number }>) {
  const { layoutId, subsheetId } = props;
  return (
    <p className="text-sm text-muted-foreground">
      No information template has been saved into the layout yet.{" "}
      <a className="underline" href={`/datasheets/layouts/${layoutId}/subsheetbuilder/${subsheetId}`}>
        Add templates
      </a>.
    </p>
  );
}

function Box(props: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="rounded-2xl border p-4">
      <div className="mb-2 text-sm font-semibold">{props.title}</div>
      {props.children}
    </section>
  );
}

/** Map a count to Tailwind grid-cols-* (avoids inline styles) */
function gridColsClass(n: number): string {
  switch (n) {
    case 1: return "grid-cols-1";
    case 2: return "grid-cols-2";
    default: return "grid-cols-2"; // future-proof: cap at 2 for current layout api
  }
}

/* --------------------------------- Main -------------------------------- */

export const SubsheetSection: React.FC<Props> = ({
  layoutId,
  subsheetId,
  subsheetName,
  fields,
  config,
}) => {
  // Apply saved slots (OrderInColumn respected inside applySubsheetLayout)
  const applied = React.useMemo(
    () => applySubsheetLayout(fields, config ?? null),
    [fields, config]
  );

  // MERGED or FALLBACK → single column full width
  if (applied.mode === "merged" || applied.mode === "fallback") {
    const rows = applied.merged ?? [];
    return (
      <Box title={subsheetName}>
        {rows.length > 0 ? <FieldTable rows={rows} /> : <EmptyHint layoutId={layoutId} subsheetId={subsheetId} />}
      </Box>
    );
  }

  // TWO-COL mode: build columns without hooks (avoid conditional hook calls)
  const columns: Array<{ key: "left" | "right"; rows: ReadonlyArray<GroupedRow> }> = [];
  if ((applied.left?.length ?? 0) > 0)  columns.push({ key: "left",  rows: applied.left!  });
  if ((applied.right?.length ?? 0) > 0) columns.push({ key: "right", rows: applied.right! });

  const colCount = columns.length;

  return (
    <Box title={subsheetName}>
      {colCount > 0 ? (
        <div className={`grid ${gridColsClass(colCount)} gap-4`}>
          {columns.map((col) => (
            <div key={col.key}>
              <FieldTable rows={col.rows} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint layoutId={layoutId} subsheetId={subsheetId} />
      )}
    </Box>
  );
};
