/** 
 * PreviewClient.tsx — performance-safe, strict TS (no any)
 * Renders datasheet header + body (subsheet sections) using saved layout.
 */

"use client";

import React from "react";
import Image from "next/image";
import { SubsheetSection } from "./renderers/SubsheetSection";
import { usePreviewData, BodySlot, RenderBlock } from "./usePreviewData";
import { rowKey, cellKey } from "./layout/keys";


type Props = Readonly<{ layoutId: number }>;

const SmallK: React.FC<Readonly<{ k: string; v?: string | number | null }>> = ({ k, v }) => (
  <div className="text-xs">
    <span className="text-muted-foreground">{k}: </span>
    <span className="font-medium">{v === null || v === undefined || String(v).trim() === "" ? "—" : String(v)}</span>
  </div>
);

function Logo(props: Readonly<{ src: string; alt: string; w?: number; h?: number }>) {
  const { src, alt, w = 60, h = 60 } = props;
  return <Image src={src} alt={alt} width={w} height={h} className="h-auto w-auto object-contain" priority />;
}

// --- Name resolution helpers (avoid numeric placeholders like "76") ---
const isNonEmpty = (s?: string | null): s is string => !!s && s.trim().length > 0;
const looksNumeric = (s?: string | null) => !!s && /^\d+$/.test(s.trim());
const pickName = (primary?: string | null, secondary?: string | null): string | null => {
  if (isNonEmpty(primary) && !looksNumeric(primary)) return primary;
  if (isNonEmpty(secondary) && !looksNumeric(secondary)) return secondary;
  return null;
};

export default function PreviewClient({ layoutId }: Props) {
  const { bundle, payload, slots, subNameMap, header, subsheetLayouts, busy, err } = usePreviewData(layoutId);

  // Build ordered rows from slots and render blocks (stable keys, no index keys)
  const renderBody = React.useCallback(() => {
    if (!payload) return null;

    const byId = new Map<number, RenderBlock>();
    for (const b of payload.body) byId.set(b.subsheetId, b);

    // Sort by row, then column for deterministic grid order
    const ordered = [...slots].sort((a, b) =>
      a.rowNumber === b.rowNumber ? a.columnNumber - b.columnNumber : a.rowNumber - b.rowNumber
    );

    // Pack into rows: merged (width=2) as single cell row; two singles side-by-side
    const rows: Array<Array<BodySlot>> = [];
    let i = 0;
    while (i < ordered.length) {
      const left = ordered[i];
      if (!left) break;
      if (left.width === 2) {
        rows.push([left]);
        i += 1;
        continue;
      }
      const right = ordered[i + 1];
      if (right && right.rowNumber === left.rowNumber && right.width === 1 && left.width === 1) {
        rows.push([left, right]);
        i += 2;
      } else {
        rows.push([left]);
        i += 1;
      }
    }

    return (
      <div className="space-y-4 mt-4">
        {rows.map((row) => {
          const isMerged = row.length === 1 && row[0].width === 2;
          const rk = rowKey(row.map((s) => s.slotIndex));
          return (
            <div key={rk} className={`grid gap-4 ${isMerged ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
              {row.map((cell) => {
                const block = byId.get(cell.subsheetId);
                const ck = cellKey(cell.slotIndex);
                // Prefer payload block name, then structure map; ignore numeric-only placeholders
                const resolved = pickName(block?.subsheetName ?? null, subNameMap[cell.subsheetId] ?? null);
                const name = resolved ?? `Subsheet ${cell.subsheetId}`;
                const fields = Array.isArray(block?.fields) ? block.fields : [];
                const cfg = subsheetLayouts[String(cell.subsheetId)] ?? subsheetLayouts[cell.subsheetId as unknown as string];

                return (
                  <div key={ck}>
                    <SubsheetSection
                      layoutId={layoutId}
                      subsheetId={cell.subsheetId}
                      subsheetName={name}
                      fields={fields}
                      config={cfg}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }, [payload, slots, subsheetLayouts, subNameMap, layoutId]);

  function renderHeader() {
    const h = header;
    return (
      <div className="rounded-2xl border p-4 space-y-3" aria-label="Sheet header preview">
        <div className="mb-1 flex items-center justify-center gap-6">
          {h?.clientLogoUrl ? <Logo src={h.clientLogoUrl} alt={`${h.clientName ?? "Client"} logo`} /> : <span className="text-[11px] text-gray-400">Client Logo</span>}
          {h?.companyLogoUrl ? <Logo src={h.companyLogoUrl} alt="Company logo" /> : <span className="text-[11px] text-gray-400">Company Logo</span>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <SmallK k="Client Doc No" v={h?.clientDocNum ?? null} />
            <SmallK k="Client Project No" v={h?.clientProjNum ?? null} />
            <SmallK k="Client Name" v={h?.clientName ?? null} />
            <SmallK
              k="Revision"
              v={
                ((h?.revisionNum !== null && h?.revisionNum !== undefined) || h?.revisionDate)
                  ? [h?.revisionNum ?? null, h?.revisionDate ?? null].filter(Boolean).join(" • ")
                  : null
              }
            />
          </div>

          <div className="text-center">
            <div className="text-lg font-semibold">{h?.sheetName ?? ""}</div>
            <div className="text-sm text-muted-foreground">{h?.sheetDesc ?? ""}</div>
            {h?.sheetDesc2 ? <div className="text-xs text-muted-foreground">{h.sheetDesc2}</div> : null}
            <div className="mt-2 text-xs">{[h?.equipmentTagNum, h?.equipmentName, h?.status].filter(Boolean).join(" • ")}</div>
          </div>

          <div className="space-y-1 text-right">
            <SmallK k="Company Doc No" v={h?.companyDocNum ?? null} />
            <SmallK k="Company Project No" v={h?.companyProjNum ?? null} />
            <SmallK k="Area" v={h?.areaName ?? null} />
            <SmallK k="Package" v={h?.packageName ?? null} />
            <SmallK k="Prepared" v={[h?.preparedBy ?? null, h?.preparedDate ?? null].filter(Boolean).join(" • ") || null} />
            <SmallK k="Verified" v={[h?.verifiedBy ?? null, h?.verifiedDate ?? null].filter(Boolean).join(" • ") || null} />
            <SmallK k="Approved" v={[h?.approvedBy ?? null, h?.approvedDate ?? null].filter(Boolean).join(" • ") || null} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <SmallK k="Project No" v={h?.projectNo ?? null} />
            <SmallK k="Project Name" v={h?.projectName ?? null} />
            <SmallK k="Service" v={h?.service ?? null} />
            <SmallK k="Qty Required" v={h?.quantityRequired ?? null} />
            <SmallK k="Equipment Size" v={h?.equipmentSize ?? null} />
            <SmallK k="Model No" v={h?.modelNo ?? null} />
          </div>
          <div className="space-y-0.5 text-center">
            <SmallK k="Driver" v={h?.driver ?? null} />
            <SmallK k="Location DWG" v={h?.locationDwg ?? null} />
            <SmallK k="P&ID" v={h?.pAndId ?? null} />
            <SmallK k="Install Std DWG" v={h?.installStdDwg ?? null} />
            <SmallK k="Code/Std" v={h?.codeStd ?? null} />
          </div>
          <div className="space-y-0.5 text-right">
            <SmallK k="Location" v={h?.location ?? null} />
            <SmallK k="Manufacturer" v={h?.manufacturer ?? null} />
            <SmallK k="Supplier" v={h?.supplier ?? null} />
            <SmallK k="Installation Pack No" v={h?.installationPackNum ?? null} />
            <SmallK k="Category" v={h?.categoryName ?? null} />
          </div>
        </div>
      </div>
    );
  }

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (busy || !bundle || !payload) return <div className="p-6">Loading preview…</div>;

  return (
    <div className="p-4">
      {renderHeader()}
      {renderBody()}
    </div>
  );
}
