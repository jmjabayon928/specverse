// src/app/(admin)/datasheets/filled/create/FilledSheetForm.tsx
"use client";

import React from "react";
import SecurePage from "@/components/security/SecurePage";
import FilledSheetCreatorForm from "./FilledSheetCreatorForm";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";

interface Props {
  template: UnifiedSheet;
  translations?: SheetTranslations | null;
  language: string;
}

export default function FilledSheetForm({ template, translations, language }: Props) {
  return (
    <SecurePage requiredPermission="DATASHEET_CREATE">
      <FilledSheetCreatorForm
        template={template}
        translations={translations}
        language={language}
      />
    </SecurePage>
  );
}
