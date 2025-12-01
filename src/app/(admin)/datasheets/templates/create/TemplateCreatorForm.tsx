// src/components/datasheets/templates/create/TemplateCreatorForm.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "react-datepicker/dist/react-datepicker.css";
import { ZodError } from "zod";
import { unifiedSheetSchema } from "@/validation/sheetSchema";
import type { UnifiedSheet, UnifiedSubsheet } from "@/domain/datasheets/sheetTypes";
import { renderInput, renderSelect, renderDate } from "@/components/ui/form/FormHelper";
import SubsheetBuilder from "./SubsheetBuilder";
import type { Option } from "@/domain/shared/commonTypes";

interface TemplateCreatorFormProps {
  mode: "create";
}

interface RefDataItem {
  id: number;
  name: string;
}

// ── Regexes hoisted & using RegExp.exec
const RE_FIELD = /^subsheets\.(\d+)\.fields\.(\d+)\.(.+)$/;
const RE_SUBSHEET = /^subsheets\.(\d+)\.(.+)$/;

// ── Helper hoisted to avoid deep nesting
const toOptions = (arr: RefDataItem[]): Option[] =>
  Array.isArray(arr) ? arr.map((i) => ({ value: i.id, label: i.name })) : [];

function flattenErrors(zodError: ZodError): Record<string, string[]> {
  const flattened: Record<string, string[]> = {};
  for (const err of zodError.errors) {
    if (err.path == null || err.path.length === 0) {
      continue;
    }

    const path = err.path.join(".");

    if (path.startsWith("subsheets.")) {
      const matchField = RE_FIELD.exec(path);
      if (matchField) {
        const [, subsheetIndexStr, templateIndexStr, field] = matchField;
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1;
        const templateIndex = Number.parseInt(templateIndexStr, 10) + 1;
        const key = `Subsheet #${subsheetIndex} - Template #${templateIndex} - ${field}`;
        flattened[key] = [err.message];
        continue;
      }

      const matchSubsheet = RE_SUBSHEET.exec(path);
      if (matchSubsheet) {
        const [, subsheetIndexStr, field] = matchSubsheet;
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1;
        const key = `Subsheet #${subsheetIndex} - ${field}`;
        flattened[key] = [err.message];
        continue;
      }
    }

    flattened[path] = [err.message];
  }
  return flattened;
}

export default function TemplateCreatorForm(props: Readonly<TemplateCreatorFormProps>) {
  const { mode } = props;
  const router = useRouter();
  const isReadOnly = false;

  const [datasheet, setDatasheet] = useState<UnifiedSheet>({
    sheetName: "",
    sheetDesc: "",
    sheetDesc2: "",
    clientDocNum: 0,
    clientProjectNum: 0,
    companyDocNum: 0,
    companyProjectNum: 0,
    areaId: 0,
    packageName: "",
    revisionNum: 1,
    revisionDate: new Date().toISOString().split("T")[0],
    preparedById: 0,
    preparedByDate: new Date().toISOString(),
    status: "Draft",
    isLatest: true,
    isTemplate: true,
    autoCADImport: false,
    itemLocation: "",
    requiredQty: 1,
    equipmentName: "",
    equipmentTagNum: "",
    serviceName: "",
    manuId: 0,
    suppId: 0,
    installPackNum: "",
    equipSize: 0,
    modelNum: "",
    driver: "",
    locationDwg: "",
    pid: 0,
    installDwg: "",
    codeStd: "",
    categoryId: 0,
    clientId: 0,
    projectId: 0,
    subsheets: [],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [areas, setAreas] = useState<Option[]>([]);
  const [manufacturers, setManufacturers] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);

  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const res = await fetch("/api/backend/references");
        const result = await res.json();

        if (!res.ok || !result) throw new Error("Invalid reference data");

        setAreas(toOptions(result.areas));
        setManufacturers(toOptions(result.manufacturers));
        setSuppliers(toOptions(result.suppliers));
        setCategories(toOptions(result.categories));
        setClients(toOptions(result.clients));
        setProjects(toOptions(result.projects));
      } catch (err) {
        console.error("❌ Failed to fetch reference data:", err);
      }
    };

    fetchReferenceData();
  }, []);

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

      let index = 0;
      for (const subsheet of parsed.subsheets) {
        const num = index + 1;

        if (subsheet.fields.length === 0) {
          manualErrors[`Subsheet #${num}`] = [
            "At least one information template is required in this subsheet.",
          ];
        }

        index++;
      }

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors);
        return;
      }

      const res = await fetch("/api/backend/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      })

      const resultJson = await res.json();
      if (!res.ok) throw new Error(resultJson.error || "Request failed");

      router.push(`/datasheets/templates/${resultJson.sheetId}`);
    } catch (err) {
      const error = err; // no unnecessary assertion
      if (error instanceof ZodError || (typeof error === "object" && error && "errors" in error)) {
        const flat = flattenErrors(error as ZodError);
        setFormErrors(flat);
      } else {
        setFormErrors({ Unknown: [(error as Error).message || "Submission failed."] });
      }
      console.error("❌ Submit error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Create Template</h1>

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
          {renderInput("Sheet Name", "sheetName", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Sheet Description", "sheetDesc", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Additional Description", "sheetDesc2", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Client Doc #", "clientDocNum", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Client Project #", "clientProjectNum", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Company Doc #", "companyDocNum", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Company Project #", "companyProjectNum", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderSelect("Area", "areaId", datasheet, handleChange, isReadOnly, areas, formErrors)}
          {renderInput("Package Name", "packageName", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Revision Number", "revisionNum", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderDate("Revision Date", "revisionDate", datasheet, handleChange, isReadOnly, formErrors)}
        </div>
      </fieldset>

      <fieldset className="border border-gray-300 rounded p-4">
        <legend className="text-md font-semibold px-2">Equipment Details</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {renderInput("Equipment Name", "equipmentName", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Equipment Tag Number", "equipmentTagNum", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Service Name", "serviceName", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Required Quantity", "requiredQty", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Item Location", "itemLocation", datasheet, handleChange, isReadOnly, formErrors)}
          {renderSelect("Manufacturer", "manuId", datasheet, handleChange, isReadOnly, manufacturers, formErrors)}
          {renderSelect("Supplier", "suppId", datasheet, handleChange, isReadOnly, suppliers, formErrors)}
          {renderInput("Install Package #", "installPackNum", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Equipment Size", "equipSize", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Model Number", "modelNum", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Driver", "driver", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Location DWG", "locationDwg", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("PID", "pid", datasheet, handleChange, isReadOnly, formErrors, "number")}
          {renderInput("Install DWG", "installDwg", datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput("Code Standard", "codeStd", datasheet, handleChange, isReadOnly, formErrors)}
          {renderSelect("Category", "categoryId", datasheet, handleChange, isReadOnly, categories, formErrors)}
          {renderSelect("Client", "clientId", datasheet, handleChange, isReadOnly, clients, formErrors)}
          {renderSelect("Project", "projectId", datasheet, handleChange, isReadOnly, projects, formErrors)}
        </div>
      </fieldset>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Subsheet(s)</h2>
        <SubsheetBuilder
          subsheets={datasheet.subsheets}
          onChange={handleSubsheetsChange}
          mode={mode}
          previewMode={false}
          readOnly={isReadOnly}
          formErrors={formErrors}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Submit Template
        </button>
      </div>
    </div>
  );
}
