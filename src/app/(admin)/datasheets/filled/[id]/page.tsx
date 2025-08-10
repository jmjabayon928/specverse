// src/app/(admin)/datasheets/filled/[id]/page.tsx
import { notFound } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import FilledSheetPageClient from "./FilledSheetPageClient";
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

export default async function FilledSheetDetailPage(context: { params: { id: string } }) {
  const session = await requireAuth();

  const sheetIdParam = context?.params?.id;
  if (!sheetIdParam) notFound();

  const sheetId = parseInt(sheetIdParam, 10);
  if (isNaN(sheetId)) notFound();

  const result = await getFilledSheetDetailsById(sheetId, "eng");
  if (!result) notFound();

  const { datasheet: filledSheet } = result;

  // Server-side: fetch notes + attachments (no proxy/CORS)
  const [initialNotes, attachmentRows] = await Promise.all([
    getSheetNotes(sheetId),
    getAttachmentsBySheet(sheetId),
  ]);
  const initialAttachments: AttachmentDTO[] = attachmentRows.map((r) => toAttachmentDTO(r, sheetId));

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <FilledSheetPageClient
        sheetId={sheetId}
        user={session}
        filledSheet={filledSheet}
        defaultLanguage="eng"
        defaultUnitSystem="SI"
        initialNotes={initialNotes}
        initialAttachments={initialAttachments}
      />
    </SecurePage>
  );
}
