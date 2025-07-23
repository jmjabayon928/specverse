"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import SheetHeaderBar from "@/components/datasheets/SheetHeaderBar";
import TemplateActions from "@/components/datasheets/templates/TemplateActions";
import TemplateViewer from "./TemplateViewer";
import { translations as labelTranslations } from "@/constants/translations";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import type { UserSession } from "@/types/session";
import type { UnifiedSheet, SheetStatus } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";

interface Props {
  sheetId: number;
  user: UserSession;
  template: UnifiedSheet;
  defaultLanguage: string;
  defaultUnitSystem: "SI" | "USC";
  initialTranslations: SheetTranslations | null;
}

const TemplatePageClient: React.FC<Props> = ({
  sheetId,
  user,
  template,
  defaultLanguage,
  defaultUnitSystem,
  initialTranslations,
}) => {
  const [lang, setLang] = useState<string>(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("lang="));
    return cookie ? decodeURIComponent(cookie.split("=")[1]) : defaultLanguage;
  });

  const [unitSystem, setUnitSystem] = useState<"SI" | "USC">(() => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("unitSystem="));
    return cookie?.includes("USC") ? "USC" : defaultUnitSystem;
  });

  const [translatedTemplate, setTranslatedTemplate] = useState<UnifiedSheet>(template);
  const [translations, setTranslations] = useState<SheetTranslations | null>(null);

  useEffect(() => {
    if (lang === "eng") {
      setTranslatedTemplate(template);
      setTranslations(null);
    } else {
      const translated = applySheetTranslations(template, initialTranslations);
      setTranslatedTemplate(translated);
      setTranslations(initialTranslations);
    }
  }, [lang, sheetId, template, initialTranslations]);

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
              {labelTranslations[template.status ?? "Draft"]?.[lang] ?? template.status} –{" "}
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
            template={{
              sheetId,
              status:
                "Draft|Rejected|Modified Draft|Verified|Approved".includes(template.status ?? "")
                  ? (template.status as SheetStatus)
                  : "Draft",
              preparedBy: template.preparedById ?? 0,
              isTemplate: true,
            }}
            user={user}
          />
        </div>
      </div>

      {/* Viewer */}
      <TemplateViewer
        data={translatedTemplate}
        translations={viewerTranslations}
        language={lang}
        unitSystem={unitSystem}
      />
    </div>
  );
};

export default TemplatePageClient;
