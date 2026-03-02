// src/app/(admin)/datasheets/filled/[id]/verify/page.tsx

import { notFound, redirect } from "next/navigation";
import { PERMISSIONS } from "@/constants/permissions";
import { apiJson } from "@/utils/apiJson.server";
import { requireAuth } from "@/utils/sessionUtils.server";
import { Metadata } from "next";
import VerifyPageClient from "./VerifyPageClient";
import VerifyForm from "./VerifyForm";
import type { UnifiedSheet } from "@/domain/datasheets/sheetTypes";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";

export const metadata: Metadata = {
  title: "Verify Filled Datasheet",
};

interface PageProps {
  readonly params: Promise<Readonly<{ id: string }>>;
}

export default async function FilledVerifyPage({ params }: Readonly<PageProps>) {
  const { id } = await params;
  const sheetId = parseInt(id ?? "0", 10);
  if (!sheetId || isNaN(sheetId)) return notFound();

  // ✅ Always enforce session and permission
  const sessionUser = await requireAuth();

  if (!sessionUser.permissions?.includes(PERMISSIONS.DATASHEET_VERIFY)) {
    return redirect("/unauthorized");
  }
  const accountId = sessionUser.accountId;
  if (accountId == null) return notFound();

  const url = `/api/backend/filledsheets/${sheetId}?lang=eng&uom=SI`
  const rawData = await apiJson<{ datasheet: UnifiedSheet; translations?: SheetTranslations | null }>(url, { cache: 'no-store' }, {
    assert: (v): v is { datasheet: UnifiedSheet; translations?: SheetTranslations | null } => typeof v === 'object' && v != null && typeof (v as { datasheet?: unknown }).datasheet === 'object' && (v as { datasheet?: unknown }).datasheet != null
  })

  return (
    <div className="container max-w-6xl py-6">
      <h1 className="text-2xl font-semibold mb-6">Verify Filled Datasheet</h1>

      {/* ✅ Read-only view of the filled sheet (client for Add Note / Add Attachment) */}
      <VerifyPageClient
        sheet={rawData.datasheet}
        translations={rawData.translations ?? null}
        language="eng"
        unitSystem="SI"
      />

      {/* ✅ Verification form */}
      <VerifyForm sheetId={sheetId} />
    </div>
  );
}
