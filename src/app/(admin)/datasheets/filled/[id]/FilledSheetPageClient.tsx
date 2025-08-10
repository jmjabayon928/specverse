// src/app/(admin)/datasheets/filled/[id]/FilledSheetPageClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import SheetHeaderBar from "@/components/datasheets/SheetHeaderBar";
import FilledSheetActions from "@/components/datasheets/filled/FilledSheetActions";
import FilledSheetViewer from "../FilledSheetViewer";
import { translations as labelTranslations } from "@/constants/translations";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import type { UserSession } from "@/types/session";
import type { SheetStatus, UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";

interface Props {
  sheetId: number;
  user: UserSession;
  filledSheet: UnifiedSheet;
  defaultLanguage: string;
  defaultUnitSystem: "SI" | "USC";
  initialNotes?: SheetNoteDTO[];
  initialAttachments?: AttachmentDTO[];
}

function getUILabel(key: string, language: string) {
  return labelTranslations[key]?.[language] ?? key;
}

const FilledSheetPageClient: React.FC<Props> = ({
  sheetId,
  user,
  filledSheet,
  defaultLanguage,
  defaultUnitSystem,
  initialNotes,
  initialAttachments,
}) => {
  const [lang, setLang] = useState<string>(defaultLanguage);
  const [unitSystem, setUnitSystem] = useState<"SI" | "USC">(defaultUnitSystem);
  const [translatedSheet, setTranslatedSheet] = useState<UnifiedSheet>(filledSheet);
  const [translations, setTranslations] = useState<SheetTranslations | null>(null);
  const status = (filledSheet.status ?? "Draft") as SheetStatus;
  const isLocked = status === "Verified" || status === "Approved";

  const canCreateNote = !isLocked && (user?.permissions?.includes("NOTE_CREATE") ?? false);
  const canEditNote   = !isLocked && (user?.permissions?.includes("NOTE_EDIT")   ?? false);
  const canDeleteNote = !isLocked && (user?.permissions?.includes("NOTE_DELETE") ?? false);
  const canAddAttachment    = !isLocked && (user?.permissions?.includes("ATTACHMENT_CREATE") ?? false);
  const canDeleteAttachment = !isLocked && (user?.permissions?.includes("ATTACHMENT_DELETE") ?? false);

  // 🔹 Safely read cookies on client only
  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookieLang = document.cookie.split("; ").find((c) => c.startsWith("lang="));
      if (cookieLang) setLang(decodeURIComponent(cookieLang.split("=")[1]));

      const cookieUOM = document.cookie.split("; ").find((c) => c.startsWith("unitSystem="));
      setUnitSystem(cookieUOM?.includes("USC") ? "USC" : "SI");
    }
  }, []);

  // 🔹 Refetch translations when lang or filledSheet changes
  useEffect(() => {
    const fetchTranslations = async () => {
      if (lang === "eng") {
        setTranslatedSheet(filledSheet);
        setTranslations(null);
        return;
      }

      try {
        const res = await fetch(`/api/backend/filledsheets/${sheetId}?lang=${lang}`);
        if (!res.ok) throw new Error("Failed to fetch sheet data");

        const result = await res.json();
        const { datasheet, translations } = result;
        const translated = applySheetTranslations(datasheet, translations);

        setTranslatedSheet(translated);
        setTranslations(translations);
      } catch (err) {
        console.error("🌐 Failed to fetch translated sheet:", err);
      }
    };

    fetchTranslations();
  }, [lang, sheetId, filledSheet]);

  const handleLangChange = (newLang: string) => {
    document.cookie = `lang=${encodeURIComponent(newLang)}; path=/; max-age=31536000`;
    setLang(newLang);
  };

  const handleUnitToggle = () => {
    const next = unitSystem === "SI" ? "USC" : "SI";
    document.cookie = `unitSystem=${next}; path=/; max-age=31536000`;
    setUnitSystem(next);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            <Image
              src={`/clients/${filledSheet.clientLogo}`}
              alt="Client Logo"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {getUILabel("DataSheet", lang)} –{" "}
              {labelTranslations[filledSheet.status ?? "Draft"]?.[lang] ?? filledSheet.status}
            </h1>
            <h1 className="text-xl font-semibold text-gray-900">
              {translatedSheet?.sheetName ?? filledSheet.sheetName}
            </h1>
            <h2 className="text-md text-gray-800">{translatedSheet?.sheetDesc}</h2>
            <h3 className="text-sm text-gray-600">{translatedSheet?.sheetDesc2}</h3>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4">
          <SheetHeaderBar
            selectedLang={lang}
            onLangChange={handleLangChange}
            unitSystem={unitSystem}
            onUnitToggle={handleUnitToggle}
          />
          <FilledSheetActions
            sheet={{
              sheetId,
              status: filledSheet.status as SheetStatus,
              preparedBy: filledSheet.preparedById ?? 0,
              isTemplate: false,
            }}
            user={user}
            unitSystem={unitSystem}
            language={lang}
            clientName={filledSheet.clientName ?? "Client"}
            sheetName={filledSheet.sheetName ?? "Sheet"}
            revisionNum={filledSheet.revisionNum ?? 0}
          />
        </div>
      </div>

      {/* Viewer */}
      <FilledSheetViewer
        sheetId={sheetId}
        sheet={translatedSheet}
        translations={translations}
        language={lang}
        unitSystem={unitSystem}
        isSheetLocked={isLocked}
        initialNotes={initialNotes}
        notePermissions={{ canCreate: canCreateNote, canEdit: canEditNote, canDelete: canDeleteNote }}
        initialAttachments={initialAttachments}
        attachmentPermissions={{ canCreate: canAddAttachment, canDelete: canDeleteAttachment }}
      />
    </div>
  );
};

export default FilledSheetPageClient;
