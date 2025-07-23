// src/app/(admin)/datasheets/templates/[id]/page.tsx

import { notFound } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/services/templateService";
import TemplatePageClient from "./TemplatePageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";

export default async function TemplateDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAuth();
  const sheetId = parseInt(params.id);
  if (isNaN(sheetId)) notFound();

  // Load the template with default English data initially
  const result = await getTemplateDetailsById(sheetId, "eng");
  if (!result) notFound();

  const { datasheet: template, translations } = result;

  return (
    <SecurePage requiredPermission="TEMPLATE_VIEW">
      <TemplatePageClient
        sheetId={sheetId}
        user={session}
        template={template}
        defaultLanguage="eng"
        defaultUnitSystem="SI"
        initialTranslations={translations}
      />
    </SecurePage>
  );
}
