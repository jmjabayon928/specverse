// src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import { unifiedSheetSchema } from "@/validation/sheetSchema";
import { renderInput, renderSelect, renderDate } from "@/components/ui/form/FormHelper";
import FilledSheetSubsheetForm from "../../create/FilledSheetSubsheetForm";
import type { UnifiedSheet, UnifiedSubsheet, InfoField } from "@/types/sheet";
import type { Option } from "@/types/common";

interface FilledSheetEditorFormProps {
  defaultValues: UnifiedSheet;
  areas: Option[];
  manufacturers: Option[];
  suppliers: Option[];
  categories: Option[];
  clients: Option[];
  projects: Option[];
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

function buildFieldValueMap(subsheets: UnifiedSubsheet[]) {
  const result: Record<string, string> = {};
  subsheets.forEach((sub) => {
    sub.fields.forEach((field) => {
      if (field.id !== undefined && field.value !== undefined && field.value !== null) {
        result[field.id.toString()] = String(field.value);
      }
    });
  });
  return result;
}

export default function FilledSheetEditorForm({
  defaultValues,
  areas,
  manufacturers,
  suppliers,
  categories,
  clients,
  projects,
}: FilledSheetEditorFormProps) {
  const router = useRouter();
  const [datasheet, setDatasheet] = useState<UnifiedSheet>(defaultValues);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(buildFieldValueMap(defaultValues.subsheets));

  const handleChange = <K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldValueChange = (subsheetIndex: number, infoTemplateId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [infoTemplateId]: value }));

    setDatasheet((prev) => {
      const updatedSubsheets = [...prev.subsheets];
      const targetSubsheet = { ...updatedSubsheets[subsheetIndex] };

      targetSubsheet.fields = targetSubsheet.fields.map((field) =>
        field.id === infoTemplateId ? { ...field, value } : field
      );

      updatedSubsheets[subsheetIndex] = targetSubsheet;
      return { ...prev, subsheets: updatedSubsheets };
    });
  };

  const handleSubmit = async () => {
    try {
      const sheetToValidate = {
        ...datasheet,
        subsheets: datasheet.subsheets.map((sub) => ({
          ...sub,
          fields: sub.fields.map((field) => ({
            ...field,
            value: fieldValues[field.id?.toString() ?? ""] || "",
          })),
        })),
      };

      const result = unifiedSheetSchema.safeParse(sheetToValidate);
      if (!result.success) {
        setFormErrors(flattenErrors(result.error));
        return;
      }

      const parsed = result.data;
      const manualErrors: Record<string, string[]> = {};

      if (parsed.subsheets.length === 0) {
        manualErrors["Subsheet(s)"] = ["At least one subsheet is required."];
      }

      parsed.subsheets.forEach((sub, i) => {
        if (sub.fields.length === 0) {
          manualErrors[`Subsheet #${i + 1}`] = ["At least one information template is required in this subsheet."];
        }

        sub.fields.forEach((field: InfoField, j) => {
          if (field.required && (field.value === undefined || String(field.value).trim() === "")) {
            const label = field.label || `Field ${j + 1}`;
            const key = `Subsheet #${i + 1} - ${label}`;
            manualErrors[key] = ["This field is required."];
          }
        });
      });

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors);
        return;
      }

      const payload = {
        ...datasheet,
        fieldValues,
      };

      const res = await fetch(`/api/backend/filledsheets/${datasheet.sheetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resultJson = await res.json();
      if (!res.ok) throw new Error(resultJson.error || "Update failed");

      router.push(`/datasheets/filled/${resultJson.sheetId}?success=updated`);
    } catch (err) {
      if (err instanceof ZodError) {
        setFormErrors(flattenErrors(err));
      } else {
        setFormErrors({ Unknown: [(err as Error).message || "Update failed."] });
      }
      console.error("❌ Submit error:", err);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit Filled Sheet</h1>

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
        {datasheet.subsheets.map((sub, i) => (
          <FilledSheetSubsheetForm
            key={sub.id ?? i}
            subsheet={sub}
            subsheetIndex={i}
            fieldValues={fieldValues}
            onFieldValueChange={handleFieldValueChange}
            formErrors={formErrors}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Update Filled Sheet
        </button>
      </div>
    </div>
  );
}

