// src/app/(admin)/datasheets/filled/create/page.tsx

import React from "react";
import { getTemplateDetailsById } from "@/backend/database/templateViewQueries";
import FilledSheetForm from "./FilledSheetForm";
import { requireAuth } from "@/utils/sessionUtils.server";
import { notFound } from "next/navigation";
import { getSheetTranslations } from "@/backend/services/translationService";
import type { SheetTranslations } from "@/types/translation";

interface PageProps {
  searchParams: {
    templateId?: string;
    lang?: string;
  };
}

export default async function FilledSheetCreatePage({ searchParams }: PageProps) {
  await requireAuth();

  const idParam = searchParams?.templateId;
  const lang = searchParams?.lang ?? "eng";
  const templateId = idParam ? Number(idParam) : NaN;

  if (!templateId || isNaN(templateId)) return notFound();

  const rawData = await getTemplateDetailsById(templateId);
  if (!rawData) return notFound();

  // 👇 Fetch translations only if lang is not English
  let translations: SheetTranslations | null = null;
  if (lang !== "eng") {
    translations = await getSheetTranslations(templateId, lang);
  }

  return (
    <div className="w-full flex justify-center px-4">
      <div className="w-full max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold mb-4">Create Filled Datasheet</h1>
        <FilledSheetForm
          template={rawData.datasheet}
          translations={translations}
          language={lang}
        />
      </div>
    </div>
  );
}
