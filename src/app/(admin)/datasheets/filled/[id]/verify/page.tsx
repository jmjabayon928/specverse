// src/app/(admin)/datasheets/filled/[id]/verify/page.tsx

import { notFound, redirect } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { requireAuth } from "@/utils/sessionUtils.server";
import { Metadata } from "next";
import VerifyPageClient from "./VerifyPageClient";
import VerifyForm from "./VerifyForm";

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

  if (!sessionUser.permissions?.includes("DATASHEET_VERIFY")) {
    return redirect("/unauthorized");
  }
  const accountId = sessionUser.accountId;
  if (accountId == null) return notFound();

  const rawData = await getFilledSheetDetailsById(sheetId, "eng", "SI", accountId);
  if (!rawData?.datasheet) return notFound();

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
