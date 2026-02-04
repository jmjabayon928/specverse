// src/app/(admin)/datasheets/filled/create/FilledSheetForm.tsx
"use client";

import React from "react";
import SecurePage from "@/components/security/SecurePage";
import { PERMISSIONS } from "@/constants/permissions";
import FilledSheetCreatorForm from "./FilledSheetCreatorForm";
import type { UnifiedSheet } from "@/domain/datasheets/sheetTypes";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";

interface Props {
  template: UnifiedSheet;
  translations?: SheetTranslations | null;
  language: string;
}

export default function FilledSheetForm(props: Readonly<Props>) {
  const { template, translations, language } = props;

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_CREATE}>
      <FilledSheetCreatorForm
        template={template}
        translations={translations}
        language={language}
        readOnlyHeader={true}
      />
    </SecurePage>
  );
}
