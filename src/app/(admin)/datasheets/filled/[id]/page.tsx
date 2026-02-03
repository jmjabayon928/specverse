// src/app/(admin)/datasheets/filled/[id]/page.tsx
import { notFound } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import FilledSheetPageClient from "./FilledSheetPageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";

type FilledParams = Readonly<{ id: string }>;
type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSheetTranslations(value: unknown): value is SheetTranslations {
  if (!isPlainObject(value)) return false;
  const v = value as { sheet?: unknown; subsheets?: unknown; labels?: unknown; options?: unknown };
  const sheetOk = v.sheet === undefined || isPlainObject(v.sheet);
  const subsheetsOk = v.subsheets === undefined || isPlainObject(v.subsheets);
  const labelsOk = v.labels === undefined || isPlainObject(v.labels);
  const optionsOk = v.options === undefined || isPlainObject(v.options);
  return sheetOk && subsheetsOk && labelsOk && optionsOk;
}

export default async function FilledSheetDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<FilledParams>;
  searchParams: Promise<SearchParamsRecord>;
}>) {
  const session = await requireAuth();

  // Next.js 15: params & searchParams are Promises
  const { id } = await params;
  const sp = await searchParams;

  if (!id) notFound();

  const sheetId = Number.parseInt(id, 10);
  if (!Number.isFinite(sheetId)) notFound();

  // Optional URL overrides (keep your existing defaults)
  const langParam = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const uomParam = Array.isArray(sp.uom) ? sp.uom[0] : sp.uom;

  // No assertion needed—these infer to string
  const defaultLanguage = langParam ?? "eng";

  // Enforce the union expected by the client prop
  const defaultUnitSystem: "SI" | "USC" = uomParam === "USC" ? "USC" : "SI";

  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const result = await getFilledSheetDetailsById(sheetId, defaultLanguage, defaultUnitSystem, accountId);
  if (!result) notFound();

  const { datasheet: filledSheet, translations } = result;
  const initialTranslations: SheetTranslations | null = isSheetTranslations(translations)
    ? translations
    : null;

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <FilledSheetPageClient
        sheetId={sheetId}
        user={session}
        filledSheet={filledSheet}
        defaultLanguage={defaultLanguage}
        defaultUnitSystem={defaultUnitSystem}
        initialTranslations={initialTranslations}
      />
    </SecurePage>
  );
}
