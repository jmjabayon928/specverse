// src/app/(admin)/datasheets/filled/create/page.tsx

import React from "react";
import { apiJson } from "@/utils/apiJson.server";
import FilledSheetForm from "./FilledSheetForm";
import { requireAuth } from "@/utils/sessionUtils.server";
import { notFound } from "next/navigation";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";
import type { UnifiedSheet } from "@/domain/datasheets/sheetTypes";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FilledSheetCreatePage(props: Readonly<PageProps>) {
  const { searchParams } = props;

  const session = await requireAuth();
  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const sp = await searchParams;
  const idParam = typeof sp.templateId === "string" ? sp.templateId : Array.isArray(sp.templateId) ? sp.templateId[0] : undefined;
  const lang = (typeof sp.lang === "string" ? sp.lang : Array.isArray(sp.lang) ? sp.lang[0] : undefined) ?? "eng";
  const templateId = idParam ? Number(idParam) : NaN;

  if (!templateId || isNaN(templateId)) return notFound();

  const rawData = await apiJson<{ datasheet: UnifiedSheet; translations: unknown }>(
    `/api/backend/templates/${templateId}?lang=${encodeURIComponent(lang)}`,
    { cache: 'no-store' }
  ).catch(() => null);
  if (!rawData) return notFound();

  // 👇 Fetch translations only if lang is not English
  let translations: SheetTranslations | null = null;
  if (lang !== "eng") {
    const translationsData = await apiJson<unknown>(
      `/api/backend/datasheets/templates/${templateId}/translations?lang=${encodeURIComponent(lang)}`,
      { cache: 'no-store' }
    ).catch(() => null);
    translations = translationsData as SheetTranslations | null;
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
