import React, { useMemo } from "react";
import type { EngineeringSystem, OtherConversion } from "@/utils/otherConversions";
import { getOtherSameSystemConversions } from "@/utils/otherConversions";
import { normalizeUnit } from "@/utils/unitKinds";

type Props = Readonly<{
  numericValue: number | string; // the main value in this row (before formatting)
  unit: string;                  // the unit shown in this row (e.g., "m", "ft", "kPa", "psi")
  system: EngineeringSystem;     // "SI" | "USC" from your toggle/state
  emptyGlyph?: string;           // optional override, default "—"
}>;

/** Optional pretty printer; keep minimal. Extend as needed for your UI. */
function prettyUnit(u: string): string {
  const n = normalizeUnit(u);
  switch (n) {
    case "l": return "L";
    case "ml": return "mL";
    case "m3": return "m³";
    case "m2": return "m²";
    case "w/m.k": return "W/m·K";
    case "kj/kg.k": return "kJ/kg·K";
    case "btu/(hr.ft.f)": return "BTU/(hr·ft·°F)";
    case "btu/(hr.ft2.f)": return "BTU/(hr·ft²·°F)";
    case "ft2.f.hr/btu": return "ft²·°F·hr/BTU";
    case "kg/m3": return "kg/m³";
    case "lb/ft3": return "lb/ft³";
    case "m3/h": return "m³/h";
    case "m3/min": return "m³/min";
    default: return u; 
  }
}

const formatNumber = (v: number): string => (Number.isFinite(v) ? v.toString() : "");

export default function OtherConversionsCell(props: Props) {
  const { numericValue, unit, system, emptyGlyph = "—" } = props;

  const valueNum: number = useMemo(() => {
    return typeof numericValue === "string" ? Number.parseFloat(numericValue) : numericValue;
  }, [numericValue]);

  const items: OtherConversion[] = useMemo(() => {
    if (!Number.isFinite(valueNum)) return [];
    return getOtherSameSystemConversions(valueNum, unit, system);
  }, [valueNum, unit, system]);

  if (!items.length) return <span aria-label="no other conversions">{emptyGlyph}</span>;

  return (
    <div className="flex flex-wrap gap-2" aria-label="other conversions">
      {items.map((it) => (
        <span key={`${it.unit}-${it.value}`} className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs">
          {formatNumber(Number.parseFloat(it.value))} {prettyUnit(it.unit)}
        </span>
      ))}
    </div>
  );
}
