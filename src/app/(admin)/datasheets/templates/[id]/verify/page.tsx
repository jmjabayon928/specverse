// src/app/(admin)/datasheets/templates/[id]/verify/page.tsx

import { notFound, redirect } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/services/templateService";
import { requireAuth } from "@/utils/sessionUtils.server";
import { Metadata } from "next";
import TemplateViewer from "../TemplateViewer";
import VerifyForm from "./VerifyForm";

export const metadata: Metadata = {
  title: "Verify Template",
};

interface PageProps {
  params: { id: string };
}

export default async function TemplateVerifyPage(props: Readonly<PageProps>) {
  const { params } = props;

  const templateId = parseInt(params.id ?? "0", 10);
  if (!templateId || isNaN(templateId)) return notFound();

  // ✅ Always enforce session and permission
  const sessionUser = await requireAuth();

  if (!sessionUser.permissions?.includes("TEMPLATE_VERIFY")) {
    return redirect("/unauthorized");
  }

  const rawData = await getTemplateDetailsById(templateId);
  if (!rawData) return notFound();

  return (
    <div className="container max-w-6xl py-6">
      <h1 className="text-2xl font-semibold mb-6">Verify Template</h1>

      {/* ✅ Read-only view of the template */}
      <TemplateViewer
        data={rawData.datasheet}
        unitSystem="SI"
        language="eng"
      />

      {/* ✅ Verification form */}
      <VerifyForm sheetId={templateId} />
    </div>
  );
}
