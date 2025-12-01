// src/app/(admin)/datasheets/filled/[id]/page.tsx
import { notFound } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import FilledSheetPageClient from "./FilledSheetPageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";

type FilledParams = Readonly<{ id: string }>;
type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>;

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

  const result = await getFilledSheetDetailsById(sheetId, defaultLanguage);
  if (!result) notFound();

  const { datasheet: filledSheet } = result;

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <FilledSheetPageClient
        sheetId={sheetId}
        user={session}
        filledSheet={filledSheet}
        defaultLanguage={defaultLanguage}
        defaultUnitSystem={defaultUnitSystem}
      />
    </SecurePage>
  );
}
