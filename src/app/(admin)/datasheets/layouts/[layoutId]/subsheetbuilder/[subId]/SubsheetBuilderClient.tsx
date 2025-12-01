"use client";

import * as React from "react";
import { useSubsheetBuilderData } from "./useSubsheetBuilderData";
import { SubsheetSection } from "@/app/(admin)/datasheets/layouts/[layoutId]/preview/renderers/SubsheetSection";

type Props = Readonly<{
  layoutId: string;
  subId: string;
}>;

export default function SubsheetBuilderClient({ layoutId, subId }: Props) {
  const {
    loading,
    error,
    sheetTitle,
    subsheetTitle,
    renderBlock,
    previewConfig,
  } = useSubsheetBuilderData({ layoutId, subId });

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (error) {
    return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <section className="space-y-4">
      <header className="border-b pb-2">
        <h1 className="text-base font-semibold">
          Subsheet Builder — {subsheetTitle ?? `Subsheet ${subId}`}
        </h1>
        {sheetTitle ? <p className="text-sm text-muted-foreground">Sheet: {sheetTitle}</p> : null}
      </header>

      {/* Your existing builder UI remains above; add the Live Preview below */}
      {renderBlock ? (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Live Preview — {subsheetTitle ?? renderBlock.subsheetName ?? `Subsheet ${subId}`}
          </h2>
          <SubsheetSection
            layoutId={Number(layoutId)}
            subsheetId={renderBlock.subsheetId}
            subsheetName={subsheetTitle ?? renderBlock.subsheetName ?? `Subsheet ${subId}`}
            fields={renderBlock.fields}     // exact preview RenderField type
            config={previewConfig}          // { merged, left: {index,infoTemplateId}[], right: … }
          />
        </section>
      ) : (
        <div className="text-sm text-muted-foreground">
          No fields to preview for this subsheet.
        </div>
      )}
    </section>
  );
}
