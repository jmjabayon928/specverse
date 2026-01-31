// src/app/(admin)/datasheets/filled/create/FilledSheetCreatorForm.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FilledSheetSubsheetForm from "./FilledSheetSubsheetForm";
import { renderInput, renderSelect } from "@/components/ui/form/FormHelper";
import type { UnifiedSheet, UnifiedSubsheet } from "@/domain/datasheets/sheetTypes";
import type { Option } from "@/domain/shared/commonTypes";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";

type FieldErrorItem = {
  infoTemplateId: number;
  message: string;
  optionsPreview?: string[];
  optionsCount?: number;
};

function displayMessage(err: FieldErrorItem): string {
  if (Array.isArray(err.optionsPreview) && err.optionsPreview.length > 0) {
    const list = err.optionsPreview.join(', ');
    const more =
      err.optionsCount != null && err.optionsCount > err.optionsPreview.length
        ? ` and ${err.optionsCount - err.optionsPreview.length} more`
        : '';
    return `Choose one of: ${list}${more}.`;
  }
  return err.message;
}

function mapFieldErrorsToFormErrors(
  fieldErrors: FieldErrorItem[],
  subsheets: UnifiedSubsheet[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const err of fieldErrors) {
    const msg = displayMessage(err);
    let found = false;
    for (let i = 0; i < subsheets.length; i++) {
      for (let j = 0; j < subsheets[i].fields.length; j++) {
        const field = subsheets[i].fields[j];
        if (field.id === err.infoTemplateId || field.originalId === err.infoTemplateId) {
          const key = `Subsheet #${i + 1} - Template #${j + 1} - value`;
          out[key] = [msg];
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      out["Unknown"] = out["Unknown"] ?? [];
      out["Unknown"].push(msg);
    }
  }
  return out;
}

interface Props {
  template: UnifiedSheet;
  translations?: SheetTranslations | null;
  language: string;
}

// Hoisted to avoid deep-nesting warnings
function toOptions(arr: { id: number; name: string }[] | undefined | null): Option[] {
  return Array.isArray(arr) ? arr.map((x) => ({ value: x.id, label: x.name })) : [];
}

// Filled reference-options returns categories as { CategoryID, CategoryName }; accept both shapes.
function categoriesToOptions(
  arr:
    | { id: number; name: string }[]
    | { CategoryID: number; CategoryName: string }[]
    | undefined
    | null
): Option[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((c) => ({
    value: 'id' in c ? c.id : c.CategoryID,
    label: 'name' in c ? c.name : String(c.CategoryName ?? ''),
  }));
}

export default function FilledSheetCreatorForm(props: Readonly<Props>) {
  const { template, translations, language } = props;
  const router = useRouter();

  const [translatedSheet, setTranslatedSheet] = useState<UnifiedSheet>(template);
  // keyed by InfoTemplateID
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({});
  const [areas, setAreas] = useState<Option[]>([]);
  const [manufacturers, setManufacturers] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (language === "eng" || !translations) {
      setTranslatedSheet(template);
    } else {
      const translated = applySheetTranslations(template, translations);
      setTranslatedSheet(translated);
    }
  }, [language, template, translations]);

  useEffect(() => {
    const fetchRefs = async () => {
      const res = await fetch("/api/backend/filledsheets/reference-options", { credentials: "include" });
      const data = await res.json();

      setAreas(toOptions(data.areas));
      setManufacturers(toOptions(data.manufacturers));
      setSuppliers(toOptions(data.suppliers));
      setCategories(categoriesToOptions(data.categories));
      setClients(toOptions(data.clients));
      setProjects(toOptions(data.projects));
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

  // Extra guard for subsheet required fields, in case any control bypasses native required.
  function validateSubsheetRequired(): { ok: boolean; message?: string } {
    for (const sub of filledSheet.subsheets || []) {
      for (const f of sub.fields || []) {
        if (f.required) {
          const v = (fieldValues[f.id!] ?? "").trim();
          if (!v) {
            return {
              ok: false,
              message: `Please fill the required field "${f.label}" in subsheet "${sub.name}".`,
            };
          }
        }
      }
    }
    return { ok: true };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // onSubmit only fires if the form is valid (native checks). We prevent the full page reload.
    setSubmitError(null);

    // Extra guard for subsheet required fields
    const v = validateSubsheetRequired();
    if (!v.ok) {
      setSubmitError(v.message || "Please complete all required fields.");
      return;
    }

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

      const resultJson = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 400 && Array.isArray(resultJson.fieldErrors)) {
          const mapped = mapFieldErrorsToFormErrors(resultJson.fieldErrors, filledSheet.subsheets ?? []);
          setFormErrors(mapped);
          setSubmitError(null);
          const firstKey = Object.keys(mapped)[0];
          if (firstKey) {
            requestAnimationFrame(() => {
              document.querySelector(`[data-error-key="${CSS.escape(firstKey)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
          }
          return;
        }
        setSubmitError(resultJson.error ?? "Failed to create filled sheet");
        setFormErrors({});
        return;
      }

      if (!resultJson.sheetId) {
        setSubmitError(resultJson.error ?? "Failed to create filled sheet");
        return;
      }

      router.push(`/datasheets/filled/${resultJson.sheetId}?success=created`);
    } catch (error) {
      console.error("❌ Submission failed:", error);
      setSubmitError((error as Error).message || "An error occurred while submitting the form.");
      setFormErrors({});
    }
  }

  return (
    <form className="max-w-6xl mx-auto px-4 space-y-6" onSubmit={handleSubmit} noValidate={false}>
      <h1 className="text-xl font-semibold">Create Filled Sheet</h1>

      {/* Datasheet Details */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Datasheet Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Mark key top-level fields as required */}
          {renderInput("Sheet Name", "sheetName", filledSheet, handleChange, true)}
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

      {/* Equipment Details */}
      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Equipment Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Equipment Name", "equipmentName", filledSheet, handleChange, true)}
          {renderInput("Equipment Tag Number", "equipmentTagNum", filledSheet, handleChange, true)}
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
          {/* Make these selects required so native validation runs */}
          {renderSelect("Category", "categoryId", filledSheet, handleChange, true, categories)}
          {renderSelect("Client", "clientId", filledSheet, handleChange, true, clients)}
          {renderSelect("Project", "projectId", filledSheet, handleChange, true, projects)}
        </div>
      </fieldset>

      {/* Subsheet fields (already mark required based on template) */}
      <div className="space-y-6 mt-6">
        {(filledSheet.subsheets || []).map((sub, i) => (
          <FilledSheetSubsheetForm
            key={sub.originalId ?? sub.id ?? `sub:${i}`}
            subsheet={sub}
            subsheetIndex={i}
            fieldValues={fieldValues}
            onFieldValueChange={handleFieldValueChange}
            formErrors={formErrors}
          />
        ))}
      </div>

      {submitError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          title="Submit filled sheet"
        >
          Submit Filled Sheet
        </button>
      </div>
    </form>
  );
}
