// src/app/(admin)/datasheets/templates/[id]/edit/page.tsx

import React from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import SecurePage from "@/components/security/SecurePage";
import TemplateEditorForm from "./TemplateEditorForm";
import { mapToUnifiedSheet } from "@/utils/templateViewMapper";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import { getTemplateDetailsById } from "@/backend/services/templateService";

interface PageProps {
  params: { id: string };
}

export default async function TemplateEditPage({ params }: PageProps) {
  // ✅ Ensure `params.id` is safely parsed and used
  const templateId = Number(params?.id ?? "0");
  if (!templateId || isNaN(templateId)) return notFound();

  const [sessionCookie, referenceData, templateData] = await Promise.all([
    cookies(),
    fetchReferenceOptions(),
    getTemplateDetailsById(templateId),
  ]);

  const token = sessionCookie.get("token")?.value;
  if (!token || !templateData) return notFound();

  const defaultValues = mapToUnifiedSheet({
    datasheet: templateData.datasheet,
    subsheets: templateData.datasheet.subsheets,
    isTemplate: true,
  });

  return (
    <SecurePage requiredPermission="TEMPLATE_EDIT">
      <TemplateEditorForm
        defaultValues={defaultValues}
        areas={referenceData.areas.map((a) => ({ label: a.name, value: a.id }))}
        manufacturers={referenceData.manufacturers.map((m) => ({ label: m.name, value: m.id }))}
        suppliers={referenceData.suppliers.map((s) => ({ label: s.name, value: s.id }))}
        categories={referenceData.categories.map((c) => ({ label: c.name, value: c.id }))}
        clients={referenceData.clients.map((c) => ({ label: c.name, value: c.id }))}
        projects={referenceData.projects.map((p) => ({ label: p.name, value: p.id }))}
        session={token}
      />
    </SecurePage>
  );
}
