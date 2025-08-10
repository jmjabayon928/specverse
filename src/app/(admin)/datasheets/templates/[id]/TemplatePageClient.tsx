// src/app/(admin)/datasheets/templates/[id]/TemplatePageClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import SheetHeaderBar from "@/components/datasheets/SheetHeaderBar";
import TemplateActions from "@/components/datasheets/templates/TemplateActions";
import TemplateViewer from "./TemplateViewer";
import { translations as labelTranslations } from "@/constants/translations";
import type { UserSession } from "@/types/session";
import type { UnifiedSheet, SheetStatus } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";

interface Props {
  sheetId: number;
  user: UserSession;
  template: UnifiedSheet;
  defaultLanguage: string;
  defaultUnitSystem: "SI" | "USC";
  initialTranslations: SheetTranslations | null;
  initialNotes?: SheetNoteDTO[];
  initialAttachments?: AttachmentDTO[];
}

function getUILabel(key: string, language: string) {
  return labelTranslations[key]?.[language] ?? key;
}

const TemplatePageClient: React.FC<Props> = ({
  sheetId,
  user,
  template,
  defaultLanguage,
  defaultUnitSystem,
  initialTranslations,
  initialNotes,
  initialAttachments,
}) => {
  const [lang, setLang] = useState<string>(defaultLanguage);
  const [unitSystem, setUnitSystem] = useState<"SI" | "USC">(defaultUnitSystem);

  useEffect(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("lang="));
    if (cookie) setLang(decodeURIComponent(cookie.split("=")[1]));
  }, []);

  useEffect(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("unitSystem="));
    if (cookie?.includes("USC")) setUnitSystem("USC");
  }, []);

  const [translatedTemplate, setTranslatedTemplate] = useState<UnifiedSheet>(template);
  const [translations, setTranslations] = useState<SheetTranslations | null>(initialTranslations);

  useEffect(() => {
    const fetchTemplateWithTranslations = async () => {
      try {
        const res = await fetch(`/api/backend/templates/${sheetId}?lang=${lang}&uom=${unitSystem}`);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const data = await res.json();
        setTranslatedTemplate(data.datasheet);
        setTranslations(data.translations);
      } catch (err) {
        console.error("Error loading translated template:", err);
      }
    };

    if (lang === "eng" && unitSystem === "SI") {
      setTranslatedTemplate(template);
      setTranslations(initialTranslations);
    } else {
      fetchTemplateWithTranslations();
    }
  }, [lang, unitSystem, sheetId, template, initialTranslations]);

  const handleLangChange = (newLang: string) => {
    document.cookie = `lang=${encodeURIComponent(newLang)}; path=/; max-age=31536000`;
    setLang(newLang);
  };

  const handleUnitToggle = () => {
    const next = unitSystem === "SI" ? "USC" : "SI";
    document.cookie = `unitSystem=${next}; path=/; max-age=31536000`;
    setUnitSystem(next);
  };

  const viewerTranslations = {
    fieldLabelMap: translations?.labels,
    subsheetLabelMap: translations?.subsheets,
    sheetFieldMap: translations?.sheet,
    optionMap: translations?.options,
  };

  // permissions + lock
  const status = (template.status ?? "Draft").toUpperCase();
  const isLocked = status === "VERIFIED" || status === "APPROVED";

  const canCreateNote  = !isLocked && (user?.permissions?.includes("NOTE_CREATE")  ?? false);
  const canEditNote    = !isLocked && (user?.permissions?.includes("NOTE_EDIT")    ?? false);
  const canDeleteNote  = !isLocked && (user?.permissions?.includes("NOTE_DELETE")  ?? false);

  const canAddAttachment    = !isLocked && (user?.permissions?.includes("ATTACHMENT_CREATE") ?? false);
  const canDeleteAttachment = !isLocked && (user?.permissions?.includes("ATTACHMENT_DELETE") ?? false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            <Image
              src={`/clients/${template.clientLogo}`}
              alt="Client Logo"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {getUILabel("Template", lang)} –{" "}
              {labelTranslations[template.status ?? "Draft"]?.[lang] ?? template.status}
            </h1>
            <h1 className="text-xl font-semibold text-gray-900">
              {translatedTemplate?.sheetName ?? template.sheetName}
            </h1>
            <h2 className="text-md text-gray-800">{translatedTemplate?.sheetDesc}</h2>
            <h3 className="text-sm text-gray-600">{translatedTemplate?.sheetDesc2}</h3>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4">
          <SheetHeaderBar
            selectedLang={lang}
            onLangChange={handleLangChange}
            unitSystem={unitSystem}
            onUnitToggle={handleUnitToggle}
          />
          <TemplateActions
            sheet={{
              sheetId,
              status:
                "Draft|Rejected|Modified Draft|Verified|Approved".includes(
                  template.status ?? ""
                )
                  ? (template.status as SheetStatus)
                  : "Draft",
              preparedBy: template.preparedById ?? 0,
              isTemplate: true,
            }}
            user={user}
            unitSystem={unitSystem}
            language={lang}
            clientName={template.clientName ?? "Client"}
            sheetName={template.sheetName ?? "Template"}
            revisionNum={template.revisionNum ?? 0}
          />
        </div>
      </div>

      {/* Viewer */}
      <TemplateViewer
        sheetId={sheetId} 
        data={translatedTemplate}
        unitSystem={unitSystem}
        language={lang}
        translations={viewerTranslations}
        isSheetLocked={isLocked}
        initialNotes={initialNotes}
        notePermissions={{
          canCreate: canCreateNote,
          canEdit: canEditNote,
          canDelete: canDeleteNote,
        }}
        initialAttachments={initialAttachments}
        attachmentPermissions={{ canCreate: canAddAttachment, canDelete: canDeleteAttachment }}
      />
    </div>
  );
};

export default TemplatePageClient;
