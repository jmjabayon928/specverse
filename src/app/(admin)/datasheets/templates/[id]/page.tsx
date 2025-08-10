// src/app/(admin)/datasheets/templates/[id]/page.tsx

import { notFound } from "next/navigation";
import { getTemplateDetailsById } from "@/backend/services/templateService";
import TemplatePageClient from "./TemplatePageClient";
import { requireAuth } from "@/utils/sessionUtils.server";
import SecurePage from "@/components/security/SecurePage";
import { getSheetNotes } from "@/backend/services/sheetNotesService";
import { getAttachmentsBySheet, type DBAttachmentRow } from "@/backend/services/attachmentsService";
import type { AttachmentDTO } from "@/types/attachments";

function toAttachmentDTO(row: DBAttachmentRow, sheetId: number): AttachmentDTO {
  return {
    AttachmentID: row.AttachmentID,
    SheetID: sheetId,
    FileName: row.OriginalName,
    StoredName: row.StoredName,
    MimeType: row.ContentType,
    SizeBytes: Number(row.FileSizeBytes),
    Url: `/api/backend/attachments/${row.AttachmentID}/view`,
    CreatedAt: row.UploadedAt instanceof Date ? row.UploadedAt.toISOString() : String(row.UploadedAt),
    CreatedBy: row.UploadedBy ?? null,
  };
}

export default async function TemplateDetailPage(
  { params }: { params: Promise<{ id: string }> } // ⬅️ make params async
) {
  const session = await requireAuth();

  const { id } = await params;                     // ⬅️ await it
  const sheetId = parseInt(id, 10);
  if (isNaN(sheetId)) notFound();

  const result = await getTemplateDetailsById(sheetId, "eng");
  if (!result) notFound();
  const { datasheet: template, translations } = result;

  const [initialNotes, attachmentRows] = await Promise.all([
    getSheetNotes(sheetId),
    getAttachmentsBySheet(sheetId),
  ]);

  const initialAttachments: AttachmentDTO[] = attachmentRows.map((r) => toAttachmentDTO(r, sheetId));

  return (
    <SecurePage requiredPermission="TEMPLATE_VIEW">
      <TemplatePageClient
        sheetId={sheetId}
        user={session}
        template={template}
        defaultLanguage="eng"
        defaultUnitSystem="SI"
        initialTranslations={translations}
        initialNotes={initialNotes}
        initialAttachments={initialAttachments}
      />
    </SecurePage>
  );
}
