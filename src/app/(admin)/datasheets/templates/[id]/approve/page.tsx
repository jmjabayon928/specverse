// src/app/(admin)/datasheets/templates/[id]/approve/page.tsx

import { notFound, redirect } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/services/templateService";
import { requireAuth } from "@/utils/sessionUtils.server";
import type { Metadata } from "next";
import TemplateViewer from "../TemplateViewer";
import ApproveButton from "./ApproveButton";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";

export const metadata: Metadata = {
  title: "Approve Template",
};

interface PageProps {
  params: { id: string };
}

// Template translations shape used by TemplateViewer
type TemplateTranslations = {
  fieldLabelMap?: Record<string, string>;
  subsheetLabelMap?: Record<string, string>;
  sheetFieldMap?: Record<string, string>;
  optionMap?: Record<string, string[]>;
} | null;

// Small helpers to avoid `any`
function getProp<T>(obj: unknown, key: string): T | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return undefined;
}

function extractStatus(ds: UnifiedSheet | Record<string, unknown>): string {
  const rec = ds as Record<string, unknown>;
  const s1 = rec["status"];
  if (typeof s1 === "string") return s1;
  const s2 = rec["Status"];
  if (typeof s2 === "string") return s2;
  return "Draft";
}

export default async function TemplateApprovePage({ params }: PageProps) {
  const templateId = Number(params.id ?? "0");
  if (!templateId || Number.isNaN(templateId)) return notFound();

  const sessionUser = await requireAuth();
  if (!sessionUser.permissions?.includes("TEMPLATE_APPROVE")) {
    return redirect("/unauthorized");
  }

  const rawData = await getTemplateDetailsById(templateId);
  if (!rawData || !rawData.datasheet) return notFound();

  // Locking: Verified/Approved = locked
  const status = extractStatus(rawData.datasheet as UnifiedSheet | Record<string, unknown>);
  const isSheetLocked = status === "Verified" || status === "Approved";

  // Optional props (only if your service returns them)
  const translations = (getProp<TemplateTranslations>(rawData, "translations") ?? null);
  const initialNotes = getProp<SheetNoteDTO[]>(rawData, "notes");
  const notePermissions = getProp<{ canCreate: boolean; canEdit: boolean; canDelete: boolean }>(
    rawData,
    "notePermissions"
  );
  const initialAttachments = getProp<AttachmentDTO[]>(rawData, "attachments");
  const attachmentPermissions = getProp<{ canCreate: boolean; canDelete: boolean }>(
    rawData,
    "attachmentPermissions"
  );

  return (
    <div className="container max-w-6xl py-6">
      <h1 className="text-2xl font-semibold mb-6">Approve Template</h1>

      <TemplateViewer
        sheetId={templateId}
        data={rawData.datasheet as UnifiedSheet}
        unitSystem="SI"
        language="eng"
        translations={translations}
        isSheetLocked={isSheetLocked}
        initialNotes={initialNotes}
        notePermissions={notePermissions}
        initialAttachments={initialAttachments}
        attachmentPermissions={attachmentPermissions}
      />

      <ApproveButton sheetId={templateId} />
    </div>
  );
}
