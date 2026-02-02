"use client";

import { useRouter } from "next/navigation";
import FilledSheetViewer from "../../FilledSheetViewer";
import type { UnifiedSheet } from "@/domain/datasheets/sheetTypes";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";

interface VerifyPageClientProps {
  sheet: UnifiedSheet;
  translations: SheetTranslations | null;
  language: string;
  unitSystem: "SI" | "USC";
}

export default function VerifyPageClient({
  sheet,
  translations,
  language,
  unitSystem,
}: Readonly<VerifyPageClientProps>) {
  const router = useRouter();

  const handleAddNote = (id: number) => {
    router.push(`/datasheets/filled/${id}/notes/new`);
  };

  const handleAddAttachment = (id: number) => {
    router.push(`/datasheets/filled/${id}/attachments/new`);
  };

  return (
    <FilledSheetViewer
      sheet={sheet}
      translations={translations}
      language={language}
      unitSystem={unitSystem}
      onAddNote={handleAddNote}
      onAddAttachment={handleAddAttachment}
    />
  );
}
