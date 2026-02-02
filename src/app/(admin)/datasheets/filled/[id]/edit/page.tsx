// src/app/(admin)/datasheets/filled/[id]/edit/page.tsx

import React from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import SecurePage from "@/components/security/SecurePage";
import FilledSheetEditorForm from "./FilledSheetEditorForm";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import { mapToUnifiedSheet } from "@/utils/templateViewMapper";
import { normalizeUom } from "@/utils/normalizeUom";

interface PageProps {
  readonly params: Promise<Readonly<{ id: string }>>;
}

export default async function FilledEditPage(props: Readonly<PageProps>) {
  const params = await props.params;
  const id = params.id;
  const sheetId = Number(id ?? "0");

  if (!sheetId || isNaN(sheetId)) return notFound();

  const [sessionCookie, referenceData, filledData] = await Promise.all([
    cookies(),
    fetchReferenceOptions(),
    getFilledSheetDetailsById(sheetId),
  ]);

  const token = sessionCookie.get("token")?.value;
  if (!token || !filledData) return notFound();

  const mapped = mapToUnifiedSheet({
    datasheet: filledData.datasheet,
    subsheets: filledData.datasheet.subsheets,
    isTemplate: false,
  });

  const defaultValues = {
    ...mapped,
    subsheets: mapped.subsheets.map((sub) => ({
      ...sub,
      fields: sub.fields.map((f) => ({ ...f, uom: normalizeUom(f.uom) })),
    })),
  };

  return (
    <SecurePage requiredPermission="DATASHEET_EDIT">
      <FilledSheetEditorForm
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
        readOnlyHeader={true}
      />
    </SecurePage>
  );
}
