// src/app/(admin)/datasheets/filled/[id]/verify/page.tsx

import { notFound, redirect } from "next/navigation";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { requireAuth } from "@/utils/sessionUtils.server";
import type { Metadata } from "next";
import FilledSheetViewer from "../../FilledSheetViewer";
import VerifyForm from "./VerifyForm";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";

export const metadata: Metadata = {
  title: "Verify Filled Datasheet",
};

interface PageProps {
  params: { id: string };
}

// Safe helpers to avoid `any`
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

export default async function FilledVerifyPage({ params }: PageProps) {
  const sheetId = Number(params.id ?? "0");
  if (!sheetId || Number.isNaN(sheetId)) return notFound();

  // ✅ Always enforce session and permission
  const sessionUser = await requireAuth();
  if (!sessionUser.permissions?.includes("DATASHEET_VERIFY")) {
    return redirect("/unauthorized");
  }

  const rawData = await getFilledSheetDetailsById(sheetId);
  if (!rawData || !rawData.datasheet) return notFound();

  // Compute locked state (Verified/Approved = locked)
  const status = extractStatus(rawData.datasheet as UnifiedSheet | Record<string, unknown>);
  const isSheetLocked = status === "Verified" || status === "Approved";

  // Optional props if your service returns them
  const translations = (getProp<SheetTranslations | null>(rawData, "translations") ?? null);
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
      <h1 className="text-2xl font-semibold mb-6">Verify Filled Datasheet</h1>

      {/* ✅ Read-only view of the filled sheet */}
      <FilledSheetViewer
        sheetId={sheetId}
        sheet={rawData.datasheet as UnifiedSheet}
        translations={translations}
        language="eng"
        unitSystem="SI"
        isSheetLocked={isSheetLocked}
        initialNotes={initialNotes}
        notePermissions={notePermissions}
        initialAttachments={initialAttachments}
        attachmentPermissions={attachmentPermissions}
      />

      {/* ✅ Verification form */}
      <VerifyForm sheetId={sheetId} />
    </div>
  );
}
