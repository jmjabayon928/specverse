// src/utils/otherConversions.ts
import { normalizeUnit, SAME_SYSTEM_ALTERNATES } from "./unitKinds";
import { convertValue } from "./unitConversionTable";

export type EngineeringSystem = "SI" | "USC";

export interface OtherConversion {
  unit: string;   // display unit (may include (a)/(g) for pressure if source had it)
  value: string;  // formatted numeric string
}

/** Known tokens by system (normalized). */
const SI_TOKENS = new Set<string>([
  "um","mm","cm","m","km","m2","m3","l","ml",
  "pa","kpa","mpa","bar","c","k",
  "kg/m3","g/m3","g/cm3",
  "m/s","km/h","m3/h","m3/min","l/min","cm3/min","nm3/h",
  "kw","w","pa.s","cp","w/m.k","m2.k/w","kj/kg.k","kj/kg@c",
  "n/m2","kg/m.s2",
]);
const USC_TOKENS = new Set<string>([
  "in","ft","yd","mi","in2","ft2","in3","ft3","gal","bbl","mil",
  "psi","ksi","f",
  "lb/ft3",
  "ft/s","mph","gpm","cfm","scfm","scfh","scf","mscf","mmscf","bcf",
  "hp","btu/(hr.ft.f)","btu/(hr.ft2.f)","ft2.f.hr/btu","lb","oz",
]);

/** Infer system from normalized unit. */
function getSystemForUnit(uRaw: string): EngineeringSystem | null {
  const u = normalizeUnit(uRaw);
  if (USC_TOKENS.has(u)) return "USC";
  if (SI_TOKENS.has(u)) return "SI";
  return null;
}

/** Return (annotation, bareUnit) for things like "kPa(a)" → ("(a)", "kpa"). */
function extractPressureAnnotation(unitRaw: string): { annot: "(a)" | "(g)" | ""; bare: string } {
  const trimmed = unitRaw.trim();
  // ✅ alternation → character class
  const m = /\(([ag])\)\s*$/i.exec(trimmed);
  if (!m) return { annot: "", bare: trimmed };
  const annot = m[1].toLowerCase() === "a" ? "(a)" : "(g)";
  // ✅ alternation → character class
  return { annot, bare: trimmed.replace(/\(([ag])\)\s*$/i, "") };
}

/** SI↔SI scale conversion for common kinds. Returns null if unknown pair. */
function scaleWithinSI(value: number, from: string, to: string): number | null {
  // Length
  const lengthScale: Record<string, number> = { um: 1e-6, mm: 1e-3, cm: 1e-2, m: 1, km: 1e3 };
  if (from in lengthScale && to in lengthScale) {
    return value * (lengthScale[from] / lengthScale[to]);
  }

  // Power
  const powerScale: Record<string, number> = { w: 1, kw: 1e3 };
  if (from in powerScale && to in powerScale) {
    return value * (powerScale[from] / powerScale[to]);
  }

  // Pressure (Pa family + bar)
  const pressurePa = { pa: 1, kpa: 1e3, mpa: 1e6, bar: 1e5 };
  if (from in pressurePa && to in pressurePa) {
    return value * (pressurePa[from as keyof typeof pressurePa] / pressurePa[to as keyof typeof pressurePa]);
  }

  // Density: kg/m3, g/m3, g/cm3
  const toKgPerM3: Record<string, (v: number) => number> = {
    "kg/m3": (v) => v,
    "g/m3": (v) => v / 1000,
    "g/cm3": (v) => v * 1000,
  };
  const fromKgPerM3: Record<string, (v: number) => number> = {
    "kg/m3": (v) => v,
    "g/m3": (v) => v * 1000,
    "g/cm3": (v) => v / 1000,
  };
  if (from in toKgPerM3 && to in fromKgPerM3) {
    const inKgPerM3 = toKgPerM3[from](value);
    return fromKgPerM3[to](inKgPerM3);
  }

  // Volumetric flow (SI): m3/min, m3/h, l/min, cm3/min (= mL/min), nm3/h
  // base = m3/s
  const flowToM3s: Record<string, (v: number) => number> = {
    "m3/min": (v) => v / 60,
    "m3/h": (v) => v / 3600,
    "l/min": (v) => (v / 1000) / 60,
    "cm3/min": (v) => (v / 1_000_000) / 60,
    "nm3/h": (v) => v / 3600,
  };
  const flowFromM3s: Record<string, (v: number) => number> = {
    "m3/min": (v) => v * 60,
    "m3/h": (v) => v * 3600,
    "l/min": (v) => (v * 60) * 1000,
    "cm3/min": (v) => (v * 60) * 1_000_000,
    "nm3/h": (v) => v * 3600,
  };
  if (from in flowToM3s && to in flowFromM3s) {
    const base = flowToM3s[from](value);
    return flowFromM3s[to](base);
  }

  // Mass flow (SI): kg/h, kg/min, kg/s, g/h, g/min, g/s
  // base = kg/s
  const massFlowToKgs: Record<string, (v: number) => number> = {
    "kg/h": (v) => v / 3600,
    "kg/min": (v) => v / 60,
    "kg/s": (v) => v,
    "g/h": (v) => (v / 1000) / 3600,
    "g/min": (v) => (v / 1000) / 60,
    "g/s": (v) => v / 1000,
  };
  const massFlowFromKgs: Record<string, (v: number) => number> = {
    "kg/h": (v) => v * 3600,
    "kg/min": (v) => v * 60,
    "kg/s": (v) => v,
    "g/h": (v) => (v * 3600) * 1000,
    "g/min": (v) => (v * 60) * 1000,
    "g/s": (v) => v * 1000,
  };
  if (from in massFlowToKgs && to in massFlowFromKgs) {
    const base = massFlowToKgs[from](value);
    return massFlowFromKgs[to](base);
  }

  return null;
}

/**
 * Returns same-system conversions for the given value/unit, constrained to the `system` toggle.
 * - Uses convertValue() for table-driven pairs (e.g., SI↔USC).
 * - Falls back to scaleWithinSI() for SI↔SI conversions.
 * - Reapplies pressure annotations "(a)/(g)" if the source had them (display only).
 */
export function getOtherSameSystemConversions(
  value: number,
  unitRaw: string,
  system: EngineeringSystem
): OtherConversion[] {
  const { annot, bare } = extractPressureAnnotation(unitRaw);
  const uNorm = normalizeUnit(bare);

  // Enforce that suggestions match the current toggle (SI/USC)
  const inferred = getSystemForUnit(uNorm);
  if (inferred && inferred !== system) return [];

  const targets = (SAME_SYSTEM_ALTERNATES[uNorm] ?? []).filter((x) => x !== uNorm);
  const out: OtherConversion[] = [];

  for (const t of targets) {
    // Try table-based conversion first (useful if one day SI↔SI is in the table)
    let v: number | null = convertValue(value, uNorm, t);
    // ✅ prefer nullish coalescing assignment
    v ??= scaleWithinSI(value, uNorm, t);
    if (v == null || !Number.isFinite(v)) continue;

    // If original was pressure with "(a)" or "(g)", re-apply to display unit
    const tIsPressure = SI_TOKENS.has(t) && ["pa","kpa","mpa","bar"].includes(t);
    const displayUnit = tIsPressure && annot ? `${t}${annot}` : t;

    out.push({ unit: displayUnit, value: v.toFixed(2) });
  }
  return out;
}
