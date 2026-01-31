// src/backend/utils/parseLang.ts

const SUPPORTED_LANGS = ['eng', 'fr', 'de', 'ru', 'zh', 'ar'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/**
 * Parses and normalizes lang from query/input.
 * - Normalizes "en" to "eng" to match template/filled controllers.
 * - Allowlist: eng, fr, de, ru, zh, ar. Unsupported or empty returns "eng".
 */
export function parseLang(q: unknown): string {
  let raw: string | undefined;
  if (typeof q === 'string' && q.trim().length > 0) {
    raw = q.trim();
  } else if (Array.isArray(q) && q.length > 0 && typeof q[0] === 'string' && q[0].trim().length > 0) {
    raw = q[0].trim();
  } else {
    return 'eng';
  }

  const normalized = raw.toLowerCase() === 'en' ? 'eng' : raw;
  if (SUPPORTED_LANGS.includes(normalized as SupportedLang)) {
    return normalized;
  }
  return 'eng';
}
