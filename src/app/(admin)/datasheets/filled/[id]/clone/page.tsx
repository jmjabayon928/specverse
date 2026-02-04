// src/app/(admin)/datasheets/filled/[id]/clone/page.tsx
import React from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import SecurePage from "@/components/security/SecurePage";
import { PERMISSIONS } from "@/constants/permissions";
import FilledSheetClonerForm from "./FilledSheetClonerForm";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import { mapToUnifiedSheet } from "@/utils/templateViewMapper";
import { requireAuth } from "@/utils/sessionUtils.server";

interface PageProps {
  readonly params: Promise<Readonly<{ id: string }>>;
}

export default async function FilledClonePage(
  { params }: Readonly<PageProps>
) {
  const { id } = await params;
  const sheetId = Number(id ?? "0");
  if (!sheetId || isNaN(sheetId)) return notFound();

  const session = await requireAuth();
  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const [sessionCookie, referenceData, filledData] = await Promise.all([
    cookies(),
    fetchReferenceOptions(accountId),
    getFilledSheetDetailsById(sheetId, "eng", "SI", accountId),
  ]);

  const token = sessionCookie.get("token")?.value;
  if (!token || !filledData) return notFound();

  // Build default values from existing (same as edit), but we’ll tweak a couple of fields in the cloner form.
  const defaultValues = mapToUnifiedSheet({
    datasheet: filledData.datasheet,
    subsheets: filledData.datasheet.subsheets,
    isTemplate: false,
  });

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_EDIT}>
      <FilledSheetClonerForm
        sourceSheetId={sheetId}
        defaultValues={defaultValues}
        areas={referenceData.areas.map((a) => ({ label: a.name, value: a.id }))}
        manufacturers={referenceData.manufacturers.map((m) => ({
          label: m.name,
          value: m.id,
        }))}
        suppliers={referenceData.suppliers.map((s) => ({
          label: s.name,
          value: s.id,
        }))}
        categories={referenceData.categories.map((c) => ({
          label: c.name,
          value: c.id,
        }))}
        clients={referenceData.clients.map((c) => ({
          label: c.name,
          value: c.id,
        }))}
        projects={referenceData.projects.map((p) => ({
          label: p.name,
          value: p.id,
        }))}
      />
    </SecurePage>
  );
}
