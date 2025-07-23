// src/app/(admin)/datasheets/filled/[id]/page.tsx
import { notFound } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import FilledSheetPageClient from "./FilledSheetPageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";

export default async function FilledSheetDetailPage(context: {
  params: { id: string };
}) {
  const session = await requireAuth();

  const sheetIdParam = context?.params?.id;
  if (!sheetIdParam) notFound();

  const sheetId = parseInt(sheetIdParam);
  if (isNaN(sheetId)) notFound();

  const result = await getFilledSheetDetailsById(sheetId, "eng");
  if (!result) notFound();

  const { datasheet: filledSheet } = result;

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <FilledSheetPageClient
        sheetId={sheetId}
        user={session}
        filledSheet={filledSheet}
        defaultLanguage="eng"
        defaultUnitSystem="SI"
      />
    </SecurePage>
  );
}
