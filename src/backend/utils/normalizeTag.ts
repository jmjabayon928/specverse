/**
 * Lightweight tag normalization: trim, uppercase, collapse whitespace, remove spaces around '-' and '/'.
 * Canonical behavior for AssetTagNorm and instrument tag norms.
 */
export function normalizeTag(input: string): string {
  let s = (input ?? '').trim()
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*-\s*/g, '-').replace(/\s*\/\s*/g, '/')
  return s.toUpperCase()
}
