// src/app/(admin)/datasheets/filled/create/FilledSheetCreatorForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FilledSheetSubsheetForm from "./FilledSheetSubsheetForm";
import { renderInput, renderSelect } from "@/components/ui/form/FormHelper";
import type { UnifiedSheet } from "@/types/sheet";
import type { Option } from "@/types/common";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import type { SheetTranslations } from "@/types/translation";

interface Props {
  template: UnifiedSheet;
  translations?: SheetTranslations | null;
  language: string;
}

export default function FilledSheetCreatorForm({ template, translations, language }: Props) {
  const router = useRouter();

  const [translatedSheet, setTranslatedSheet] = useState<UnifiedSheet>(template);
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({});
  const [areas, setAreas] = useState<Option[]>([]);
  const [manufacturers, setManufacturers] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);

  useEffect(() => {
    if (language === "eng" || !translations) {
      setTranslatedSheet(template);
    } else {
      const translated = applySheetTranslations(template, translations, language);
      setTranslatedSheet(translated);
    }
  }, [language, template, translations]);

  useEffect(() => {
    const fetchRefs = async () => {
      const res = await fetch("/api/backend/references");
      const data = await res.json();

      const toOpts = (arr: { id: number; name: string }[]) =>
        arr.map((x) => ({ value: x.id, label: x.name }));

      setAreas(toOpts(data.areas));
      setManufacturers(toOpts(data.manufacturers));
      setSuppliers(toOpts(data.suppliers));
      setCategories(toOpts(data.categories));
      setClients(toOpts(data.clients));
      setProjects(toOpts(data.projects));
    };

    fetchRefs();
  }, []);

  const [filledSheet, setFilledSheet] = useState<UnifiedSheet>({
    ...template,
    isTemplate: false,
    status: "Draft",
    templateId: template.sheetId,
    subsheets: template.subsheets,
  });

  useEffect(() => {
    setFilledSheet((prev) => ({
      ...prev,
      subsheets: translatedSheet.subsheets,
    }));
  }, [translatedSheet]);

  const handleChange = <K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setFilledSheet((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldValueChange = (
    subsheetIndex: number,
    infoTemplateId: number,
    value: string
  ) => {
    setFieldValues((prev) => ({
      ...prev,
      [infoTemplateId]: value,
    }));
  };

  const handleSubmit = async () => {
    const payload = {
      ...filledSheet,
      fieldValues,
    };

    try {
      const res = await fetch("/api/backend/filledsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resultJson = await res.json();

      if (!res.ok || !resultJson.sheetId) {
        throw new Error(resultJson.error || "Failed to create filled sheet");
      }

      router.push(`/datasheets/filled/${resultJson.sheetId}?success=created`);
    } catch (error) {
      console.error("\u274C Submission failed:", error);
      alert((error as Error).message || "An error occurred while submitting the form.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 space-y-6">
      <h1 className="text-xl font-semibold">Create Filled Sheet</h1>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Datasheet Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Sheet Name", "sheetName", filledSheet, handleChange)}
          {renderInput("Sheet Description", "sheetDesc", filledSheet, handleChange)}
          {renderInput("Additional Description", "sheetDesc2", filledSheet, handleChange)}
          {renderInput("Client Doc #", "clientDocNum", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Client Project #", "clientProjectNum", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Company Doc #", "companyDocNum", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Company Project #", "companyProjectNum", filledSheet, handleChange, false, {}, "number")}
          {renderSelect("Area", "areaId", filledSheet, handleChange, false, areas)}
          {renderInput("Package Name", "packageName", filledSheet, handleChange)}
          {renderInput("Revision Number", "revisionNum", filledSheet, handleChange, false, {}, "number")}
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Equipment Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Equipment Name", "equipmentName", filledSheet, handleChange)}
          {renderInput("Equipment Tag Number", "equipmentTagNum", filledSheet, handleChange)}
          {renderInput("Service Name", "serviceName", filledSheet, handleChange)}
          {renderInput("Required Quantity", "requiredQty", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Item Location", "itemLocation", filledSheet, handleChange)}
          {renderSelect("Manufacturer", "manuId", filledSheet, handleChange, false, manufacturers)}
          {renderSelect("Supplier", "suppId", filledSheet, handleChange, false, suppliers)}
          {renderInput("Install Package #", "installPackNum", filledSheet, handleChange)}
          {renderInput("Equipment Size", "equipSize", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Model Number", "modelNum", filledSheet, handleChange)}
          {renderInput("Driver", "driver", filledSheet, handleChange)}
          {renderInput("Location DWG", "locationDwg", filledSheet, handleChange)}
          {renderInput("PID", "pid", filledSheet, handleChange, false, {}, "number")}
          {renderInput("Install DWG", "installDwg", filledSheet, handleChange)}
          {renderInput("Code Standard", "codeStd", filledSheet, handleChange)}
          {renderSelect("Category", "categoryId", filledSheet, handleChange, false, categories)}
          {renderSelect("Client", "clientId", filledSheet, handleChange, false, clients)}
          {renderSelect("Project", "projectId", filledSheet, handleChange, false, projects)}
        </div>
      </fieldset>

      <div className="space-y-6 mt-6">
        {filledSheet.subsheets.map((sub, i) => (
          <FilledSheetSubsheetForm
            key={i}
            subsheet={sub}
            subsheetIndex={i}
            fieldValues={fieldValues}
            onFieldValueChange={handleFieldValueChange}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Submit Filled Sheet
        </button>
      </div>
    </div>
  );
}


