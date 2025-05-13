"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Datasheet, Equipment, Subsheet } from "@/types/datasheetTemplate";
import TemplateDetailClient from "./TemplateDetailClient";

type Template = {
  datasheet: Datasheet;
  equipment: Equipment;
  subsheets: Subsheet[];
};

type ReferenceOptions = {
  areas: { id: number; name: string }[];
  users: { id: number; name: string }[];
  manufacturers: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  projects: { id: number; name: string }[];
};

export default function TemplateDetailPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const templateId = Number(id);
  const isEditMode = searchParams.get("edit") === "true";

  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<Template | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptions | null>(null);

  useEffect(() => {
    if (!templateId || isNaN(templateId)) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [templateRes, optionsRes] = await Promise.all([
          fetch(`/api/backend/datasheets/templates/${templateId}/detail`, { cache: "no-store" }), 
          fetch(`/api/backend/datasheets/templates/reference-options`), 
        ]);

        if (!templateRes.ok) throw new Error(`Template fetch failed (${templateRes.status})`);
        if (!optionsRes.ok) throw new Error(`Options fetch failed (${optionsRes.status})`);

        const template = await templateRes.json();
        const options = await optionsRes.json();

        setTemplate(template);
        setReferenceOptions(options);
      } catch (err) {
        console.error("❌ Fetch failed", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [templateId]);

  if (isLoading) return <div className="p-6 text-sm text-gray-600">Loading...</div>;
  if (!template || !referenceOptions)
    return <div className="p-6 text-red-600">Template not found or server error.</div>;

  return (
    <TemplateDetailClient
      templateId={templateId}
      template={template}
      referenceOptions={referenceOptions}
      isEditMode={isEditMode}
    />
  );
}
