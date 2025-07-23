// src/components/datasheets/templates/edit/TemplateEditorForm.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import { unifiedSheetSchema } from "@/validation/sheetSchema";
import { renderInput, renderSelect, renderDate } from "@/components/ui/form/FormHelper";
import SubsheetBuilder from "../../create/SubsheetBuilder";
import type { UnifiedSheet, UnifiedSubsheet } from "@/types/sheet";
import type { Option } from "@/types/common";

interface TemplateEditorFormProps {
  defaultValues: UnifiedSheet;
  areas: Option[];
  manufacturers: Option[];
  suppliers: Option[];
  categories: Option[];
  clients: Option[];
  projects: Option[];
  session: string;
}

function flattenErrors(zodError: ZodError): Record<string, string[]> {
  const flattened: Record<string, string[]> = {};

  zodError.errors.forEach((err) => {
    if (err.path?.length > 0) {
      const path = err.path.join(".");

      if (path.startsWith("subsheets.")) {
        const match = path.match(/subsheets\.(\d+)\.fields\.(\d+)\.(.+)/);
        if (match) {
          const [, subsheetIndexStr, templateIndexStr, field] = match;
          const subsheetIndex = parseInt(subsheetIndexStr, 10) + 1;
          const templateIndex = parseInt(templateIndexStr, 10) + 1;
          const key = `Subsheet #${subsheetIndex} - Template #${templateIndex} - ${field}`;
          flattened[key] = [err.message];
          return;
        }

        const matchSubsheet = path.match(/subsheets\.(\d+)\.(.+)/);
        if (matchSubsheet) {
          const [, subsheetIndexStr, field] = matchSubsheet;
          const subsheetIndex = parseInt(subsheetIndexStr, 10) + 1;
          const key = `Subsheet #${subsheetIndex} - ${field}`;
          flattened[key] = [err.message];
          return;
        }
      }

      flattened[path] = [err.message];
    }
  });

  return flattened;
}

export default function TemplateEditorForm({
  defaultValues,
  areas,
  manufacturers,
  suppliers,
  categories,
  clients,
  projects,
}: TemplateEditorFormProps) {
  const router = useRouter();
  const [datasheet, setDatasheet] = useState<UnifiedSheet>(defaultValues);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

  const handleChange = <K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubsheetsChange = (subsheets: UnifiedSubsheet[]) => {
    setDatasheet((prev) => ({ ...prev, subsheets }));
  };

  const handleSubmit = async () => {
    try {
      const result = unifiedSheetSchema.safeParse(datasheet);

      if (!result.success) {
        const flat = flattenErrors(result.error);
        setFormErrors(flat);
        return;
      }

      const parsed = result.data;
      const manualErrors: Record<string, string[]> = {};

      if (parsed.subsheets.length === 0) {
        manualErrors["Subsheet(s)"] = ["At least one subsheet is required."];
      }

      parsed.subsheets.forEach((sub, i) => {
        if (sub.fields.length === 0) {
          manualErrors[`Subsheet #${i + 1}`] = [
            "At least one information template is required in this subsheet.",
          ];
        }
      });

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors);
        return;
      }

      console.log("📤 Submitting subsheets:", datasheet.subsheets);

      const res = await fetch(`/api/backend/templates/${datasheet.sheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datasheet),
      });

      const resultJson = await res.json();
      if (!res.ok) throw new Error(resultJson.error || "Update failed");

      router.push(`/datasheets/templates/${resultJson.sheetId}`);
    } catch (err) {
      if (err instanceof ZodError) {
        const flat = flattenErrors(err);
        setFormErrors(flat);
      } else {
        setFormErrors({ Unknown: [(err as Error).message || "Update failed."] });
      }
      console.error("❌ Submit error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit Template</h1>

      {formErrors && Object.keys(formErrors).length > 0 && (
        <div className="p-4 bg-red-100 text-red-700 border border-red-400 rounded">
          <ul className="list-disc pl-5 space-y-1">
            {Object.entries(formErrors).map(([key, messages]) => (
              <li key={key}>
                <strong>{key}</strong>: {messages.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Datasheet Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Sheet Name", "sheetName", datasheet, handleChange, false, formErrors)}
          {renderInput("Sheet Description", "sheetDesc", datasheet, handleChange, false, formErrors)}
          {renderInput("Additional Description", "sheetDesc2", datasheet, handleChange, false, formErrors)}
          {renderInput("Client Doc #", "clientDocNum", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Client Project #", "clientProjectNum", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Company Doc #", "companyDocNum", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Company Project #", "companyProjectNum", datasheet, handleChange, false, formErrors, "number")}
          {renderSelect("Area", "areaId", datasheet, handleChange, false, areas, formErrors)}
          {renderInput("Package Name", "packageName", datasheet, handleChange, false, formErrors)}
          {renderInput("Revision Number", "revisionNum", datasheet, handleChange, false, formErrors, "number")}
          {renderDate("Revision Date", "revisionDate", datasheet, handleChange, false, formErrors)}
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Equipment Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Equipment Name", "equipmentName", datasheet, handleChange, false, formErrors)}
          {renderInput("Equipment Tag Number", "equipmentTagNum", datasheet, handleChange, false, formErrors)}
          {renderInput("Service Name", "serviceName", datasheet, handleChange, false, formErrors)}
          {renderInput("Required Quantity", "requiredQty", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Item Location", "itemLocation", datasheet, handleChange, false, formErrors)}
          {renderSelect("Manufacturer", "manuId", datasheet, handleChange, false, manufacturers, formErrors)}
          {renderSelect("Supplier", "suppId", datasheet, handleChange, false, suppliers, formErrors)}
          {renderInput("Install Package #", "installPackNum", datasheet, handleChange, false, formErrors)}
          {renderInput("Equipment Size", "equipSize", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Model Number", "modelNum", datasheet, handleChange, false, formErrors)}
          {renderInput("Driver", "driver", datasheet, handleChange, false, formErrors)}
          {renderInput("Location DWG", "locationDwg", datasheet, handleChange, false, formErrors)}
          {renderInput("PID", "pid", datasheet, handleChange, false, formErrors, "number")}
          {renderInput("Install DWG", "installDwg", datasheet, handleChange, false, formErrors)}
          {renderInput("Code Standard", "codeStd", datasheet, handleChange, false, formErrors)}
          {renderSelect("Category", "categoryId", datasheet, handleChange, false, categories, formErrors)}
          {renderSelect("Client", "clientId", datasheet, handleChange, false, clients, formErrors)}
          {renderSelect("Project", "projectId", datasheet, handleChange, false, projects, formErrors)}
        </div>
      </fieldset>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Subsheet(s)</h2>
        <SubsheetBuilder
          subsheets={datasheet.subsheets}
          onChange={handleSubsheetsChange}
          mode="edit"
          previewMode={false}
          readOnly={false}
          formErrors={formErrors}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Update Template
        </button>
      </div>
    </div>
  );
}
