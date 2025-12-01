// preview/utils/multiCaseGrouping.ts
import type { RenderField } from "../groupFields";

/** Normalize tokens to match consistently across inputs. */
function normalizeToken(raw: string): string {
  const base = raw.toLowerCase().replaceAll(/[.\s]/g, "");
  switch (base) {
    case "min":
    case "minimum":
      return "min";
    case "norm":
    case "normal":
    case "nom":
      return "norm";
    case "max":
    case "maximum":
      return "max";
    case "rated":
      return "rated";
    case "design":
      return "design";
    default:
      return base;
  }
}

/** Build caption→index map from provided cases. */
function buildIndexMap(cases: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  let i = 0;
  for (const c of cases) {
    m.set(normalizeToken(c), i++);
  }
  return m;
}

/** Extract trailing "(...)" suffix from a label. */
function extractSuffix(label: string): { baseLabel: string; suffix: string } | null {
  const m = /(.*)\(([^)]+)\)\s*$/.exec(label.trim());
  if (!m) return null;
  const base = m[1].trim();
  const suffix = m[2].trim();
  if (!base || !suffix) return null;
  return { baseLabel: base, suffix };
}

/**
 * Factory: returns a normalizer that converts "Label (Case)" into grouped cells.
 * - groupKey = base label
 * - cellCaption = the exact caption from `cases`
 * - cellIndex = position within `cases`
 * Works for any arity: 2, 3, 4, 8, …
 */
export function buildMultiCaseNormalizer(cases: readonly string[]) {
  const indexByToken = buildIndexMap(cases);

  return function normalize(f: RenderField): RenderField {
    const parsed = extractSuffix(f.label);
    if (!parsed) return f;

    const token = normalizeToken(parsed.suffix);
    const pos = indexByToken.get(token);
    if (pos == null) return f; // suffix not recognized → leave as-is

    const caption = cases[pos]; // preserve exact display text

    return {
      ...f,
      label: parsed.baseLabel,
      groupKey: parsed.baseLabel,
      cellCaption: caption,
      cellIndex: pos, // no assertion needed; pos is narrowed to number
    };
  };
}
