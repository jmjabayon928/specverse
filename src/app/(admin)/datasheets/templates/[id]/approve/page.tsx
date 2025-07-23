// src/app/(admin)/datasheets/templates/[id]/approve/page.tsx

import { notFound, redirect } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/database/templateViewQueries";
import { requireAuth } from "@/utils/sessionUtils.server";
import { Metadata } from "next";
import TemplateViewer from "../TemplateViewer";
import ApproveButton from "./ApproveButton";

export const metadata: Metadata = {
  title: "Approve Template",
};

interface PageProps {
  params: { id: string };
}

export default async function TemplateApprovePage({ params }: PageProps) {
  const templateId = parseInt(params.id ?? "0", 10);
  if (!templateId || isNaN(templateId)) return notFound();

  const sessionUser = await requireAuth();
  if (!sessionUser.permissions?.includes("TEMPLATE_APPROVE")) {
    return redirect("/unauthorized");
  }

  const rawData = await getTemplateDetailsById(templateId);
  if (!rawData) return notFound();

  return (
    <div className="container max-w-6xl py-6">
      <h1 className="text-2xl font-semibold mb-6">Approve Template</h1>

      <TemplateViewer data={rawData.datasheet} />

      <ApproveButton sheetId={templateId} />
    </div>
  );
}
