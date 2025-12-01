// src/app/(admin)/datasheets/templates/[id]/page.tsx
import { notFound } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/services/templateService";
import TemplatePageClient from "./TemplatePageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";

type TemplateParams = Readonly<{ id: string }>;
type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>;

export default async function TemplateDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<TemplateParams>;
  searchParams: Promise<SearchParamsRecord>;
}>) {
  const session = await requireAuth();

  // Next.js 15: await params/searchParams
  const { id } = await params;
  const sp = await searchParams;

  const sheetId = Number.parseInt(id ?? "", 10);
  if (!Number.isFinite(sheetId)) notFound();

  const langParam = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const uomParam = Array.isArray(sp.uom) ? sp.uom[0] : sp.uom;

  const defaultLanguage = langParam ?? "eng";
  const defaultUnitSystem: "SI" | "USC" = uomParam === "USC" ? "USC" : "SI";

  // SSR: load with the resolved default language (previously hard-coded "eng")
  const result = await getTemplateDetailsById(sheetId, defaultLanguage);
  if (!result) notFound();

  const { datasheet: template, translations } = result;

  return (
    <SecurePage requiredPermission="TEMPLATE_VIEW">
      <TemplatePageClient
        sheetId={sheetId}
        user={session}
        template={template}
        defaultLanguage={defaultLanguage}
        defaultUnitSystem={defaultUnitSystem}
        initialTranslations={translations}
      />
    </SecurePage>
  );
}
