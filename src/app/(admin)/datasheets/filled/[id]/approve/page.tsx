// src/app/(admin)/datasheets/filled/[id]/approve/page.tsx

import { notFound, redirect } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { requireAuth } from "@/utils/sessionUtils.server";
import { Metadata } from "next";
import FilledSheetViewer from "../../FilledSheetViewer";
import ApproveButton from "./ApproveButton";

export const metadata: Metadata = {
  title: "Approve Filled Sheet",
};

interface PageProps {
  params: { id: string };
}

export default async function FilledApprovePage({ params }: PageProps) {
  const sheetId = parseInt(params.id ?? "0", 10);
  if (!sheetId || isNaN(sheetId)) return notFound();

  const sessionUser = await requireAuth();
  if (!sessionUser.permissions?.includes("DATASHEET_APPROVE")) {
    return redirect("/unauthorized");
  }

  const rawData = await getFilledSheetDetailsById(sheetId);
  if (!rawData || !rawData.datasheet) return notFound();

  return (
    <div className="container max-w-6xl py-6">
      <h1 className="text-2xl font-semibold mb-6">Approve Filled Sheet</h1>

      {/* ✅ Reuse viewer for read-only mode */}
      <FilledSheetViewer data={rawData.datasheet} />

      {/* ✅ Button to approve */}
      <ApproveButton sheetId={sheetId} />
    </div>
  );
}
