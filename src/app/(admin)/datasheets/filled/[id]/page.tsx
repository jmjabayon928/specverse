"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from 'next/image';
import { convertToUSC, getUSCUnit } from '@/utils/unitConversionTable';
import { handleExport } from "@/utils/datasheetExport";

// Define types
type Datasheet = {
  SheetName: string;
  SheetDesc: string;
  SheetDesc2?: string;
  ClientDocNum: string;
  ClientProjNum: string;
  CompanyDocNum: string;
  CompanyProjNum: string;
  AreaName: string;
  PackageName: string;
  RevisionNum: number;
  RevisionDate: string;
  PreparedBy: string;
  PreparedByDate: string;
  VerifiedBy: string;
  VerifiedByDate: string;
  ApprovedBy: string;
  ApprovedByDate: string;
  EquipmentName: string;
  EquipmentTagNum: string;
  ServiceName: string;
  ClientName: string;
  ProjectName: string;
  CategoryName: string;
  ManuName: string;
  SuppName: string;
  RequiredQty: number;
  EquipSize: number;
  InstallPackNum: string;
  ModelNumber: string;
  PID: number;
  CodeStd: string;
  ItemLocation: string;
  LocationDwg: string;
  InstallDwg: string;
  Driver: string;
  ClientLogo: string;
  Status: "Draft" | "Verified" | "Approved";
};

type Subsheet = {
  SubID: number;
  SubNameEng: string;
  SubNameFr: string;
};

type SubsheetInfo = {
  InfoTemplateID: number;
  LabelEng: string;
  LabelFr: string;
  InfoType: string;
  InfoValue: string;
  UOM: string;
  TemplateUOM: string; 
  Options?: string[];
};

type ChangeLog = {
  LogID: number;
  LabelEng: string;
  OldValue: string | null;
  NewValue: string | null;
  UOM: string | null;
  ChangedAt: string;
  ChangedBy: string;
};

type EditedInfo = {   // 👈 add it here
  InfoValue: string;
  UOM: string;
};

type LanguageOption = {
  LanguageCode: string;
  LanguageName: string;
  FlagEmoji?: string; // optional, in case some records don't have it
};

type UILabelMap = Record<string, string>;

export default function DatasheetDetailsPage() {
  const params = useParams();
  const rawId = params?.id;
  const SheetId = Array.isArray(rawId) ? rawId[0] : rawId ?? "";

  const [datasheet, setDatasheet] = useState<Datasheet | null>(null);
  const [subsheets, setSubsheets] = useState<Subsheet[]>([]);
  const [subsheetInfo, setSubsheetInfo] = useState<Record<string, SubsheetInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"eng" | "fr">("eng");
  const [uom, setUom] = useState<"SI" | "USC">("SI");
  const [editedInfo, setEditedInfo] = useState<Record<number, EditedInfo>>({});
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [selectedLang, setSelectedLang] = useState("eng");
  const [translatedSubsheets, setTranslatedSubsheets] = useState([]);
  const [templateTranslations, setTemplateTranslations] = useState<Record<number, string>>({});
  const [labelTranslations, setLabelTranslations] = useState<UILabelMap>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false); 
  const searchParams = useSearchParams();
  const showLogsQuery = searchParams?.get("showLogs") === "true";
  const getSubsheetInfos = (subID: number) => subsheetInfo?.[String(subID)] ?? [];

  useEffect(() => {
    if (showLogsQuery) setShowLogs(true);
  }, [showLogsQuery]);

  useEffect(() => {
    async function loadTranslations() {
      const res = await fetch(`http://localhost:5000/api/backend/datasheets/${SheetId}/subsheets/translated?lang=${selectedLang}`);
      const data = await res.json();
      console.log("🔠 Translated subsheets loaded:", data); // 👈
      setTranslatedSubsheets(data);
    }
    loadTranslations();
  }, [SheetId, selectedLang]);

  useEffect(() => {
    if (!SheetId || selectedLang === "eng") return; 
  
    async function fetchTemplateTranslations() {
      try {
        const res = await fetch(`http://localhost:5000/api/backend/datasheets/templates/${SheetId}/translations?lang=${selectedLang}`)
        const data = await res.json();
  
        const map: Record<number, string> = {};
        data.forEach((item: { InfoTemplateID: number; Label: string }) => {
          map[item.InfoTemplateID] = item.Label;
        });
  
        setTemplateTranslations(map);
      } catch (err) {
        console.error("Error fetching template translations:", err);
      }
    }
  
    fetchTemplateTranslations();
  }, [selectedLang, SheetId]);

  // ✅ Build map once translations are loaded
  const translationMap = useMemo(() => {
    const map: Record<string, string> = {};
    // 🔒 defensive: if translatedSubsheets is not array, skip
    if (Array.isArray(translatedSubsheets)) {
      translatedSubsheets.forEach((item: { SubID: number; SubName: string }) => {
        map[item.SubID.toString()] = item.SubName;
      });
    }
    return map;
  }, [translatedSubsheets]);
  
  useEffect(() => {
    async function fetchLogs() {
      const res = await fetch(`http://localhost:5000/api/backend/datasheets/${SheetId}/change-logs`);
      const data = await res.json();
      setChangeLogs(data);
    }
  
    if (showLogs) fetchLogs();
  }, [showLogs, SheetId]);

  useEffect(() => {
    async function loadLanguages() {
      try {
        const res = await fetch("http://localhost:5000/api/languages");
        const data = await res.json();
        setLanguages(data);
      } catch (err) {
        console.error("Error fetching languages:", err);
      }
    }
  
    loadLanguages();
  }, []);

  useEffect(() => {
    async function loadUILabelTranslations() {
      try {
        const res = await fetch(`http://localhost:5000/api/ui-labels?lang=${selectedLang}`);
        const data = await res.json();
        setLabelTranslations(data);
      } catch (err) {
        console.error("❌ Failed to fetch label translations:", err);
      }
    }
  
    if (selectedLang) {
      loadUILabelTranslations();
    }
  }, [selectedLang]);

  // ✅ Helper function to get label with fallback
  function getLabel(key: string): string {
    return labelTranslations[key] || key;
  }
  
  // ✅ Place the formatDate function here
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function handleValueChange(subsheetID: string, templateId: number, field: string, value: string) {
    // ✅ Update subsheetInfo (visible data)
    setSubsheetInfo((prev) => {
        const updated = { ...prev };
        const list = updated[subsheetID] || [];

        updated[subsheetID] = list.map((item) =>
            item.InfoTemplateID === templateId
                ? { ...item, [field]: value }
                : item
        );

        return updated;
    });

    // ✅ Update editedInfo (for backend saving)
    setEditedInfo((prev) => ({
        ...prev,
        [templateId]: {
            InfoValue: field === "InfoValue" ? value : prev[templateId]?.InfoValue ?? "",
            UOM: field === "UOM" ? value : prev[templateId]?.UOM ?? "",
        },
    }));

    // ✅ Re-validate after value change
    const changedInfo = subsheetInfo[subsheetID]?.find(
        (info) => info.InfoTemplateID === templateId
    );

    if (!changedInfo) return;

    const errorMsg = validateField(
        changedInfo.InfoValue,
        changedInfo
    );

    setValidationErrors((prev) => ({
        ...prev,
        [templateId]: errorMsg || "",
    }));
  }

  // ✅ Fetch datasheet main details
  const fetchDatasheetAndSubsheets = useCallback(async () => {
    if (!SheetId) return;

    setLoading(true);
    try {
      const [datasheetRes, subsheetsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/backend/datasheets/detail/${SheetId}`),
        fetch(`http://localhost:5000/api/backend/datasheets/${SheetId}/subsheets`)
      ]);

      const datasheetData = await datasheetRes.json();
      const subsheetsData = await subsheetsRes.json();

      setDatasheet(datasheetData);
      setSubsheets(subsheetsData);
    } catch (error) {
      console.error("Failed to fetch datasheet or subsheets:", error);
    } finally {
      setLoading(false);
    }
  }, [SheetId]);

  // ✅ Fetch all subsheet info
  const fetchAllInfos = useCallback(async () => {
    if (!SheetId) return;

    const infoData: Record<string, SubsheetInfo[]> = {};

    for (const sub of subsheets) {
      if (!sub?.SubID) continue;

      try {
        const res = await fetch(`http://localhost:5000/api/backend/datasheets/subsheets/${sub.SubID}/sheet/${SheetId}/info`);
        const data: SubsheetInfo[] = await res.json();
        infoData[sub.SubID.toString()] = data;
      } catch (error) {
        console.error(`Failed fetching info for SubID ${sub.SubID}:`, error);
      }
    }
    setSubsheetInfo(infoData);
  }, [subsheets, SheetId]);

  useEffect(() => {
    fetchDatasheetAndSubsheets();
  }, [fetchDatasheetAndSubsheets]);

  useEffect(() => {
    if (subsheets.length > 0) {
      fetchAllInfos();
    }
  }, [subsheets, fetchAllInfos]);

  // ✅ Validation
  function validateField(value: string, template: SubsheetInfo): string | null {
    const trimmed = value.trim();

    // ✅ Always require a value
    if (!trimmed) return "Value is required.";

    // ✅ If options exist, value must match one of them
    if (template.Options && template.Options.length > 0) {
        if (!template.Options.includes(trimmed)) return "Invalid option selected.";
        return null;
    }

    // ✅ Validate numeric types
    if (template.InfoType === "int" && !/^-?\d+$/.test(trimmed)) return "Must be an integer.";
    if (template.InfoType === "decimal" && isNaN(Number(trimmed))) return "Must be a number.";

    return null;
  }

  function preparePayload() {
    const payload: Record<number, { InfoValue: string; UOM: string }> = {};

    for (const [templateIdStr, entry] of Object.entries(editedInfo)) {
      const templateId = Number(templateIdStr);

      const template = Object.values(subsheetInfo).flat().find(info => info.InfoTemplateID === templateId);
      if (!template) continue;

      payload[templateId] = {
        InfoValue: entry.InfoValue,
        UOM: template.TemplateUOM
      };
    }

    return payload;
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    const newErrors: Record<number, string> = {};

    // ✅ Validate ALL subsheet values (both filled & unfilled datasheets)
    for (const infos of Object.values(subsheetInfo)) {
        for (const info of infos) {
            const error = validateField(info.InfoValue, info);
            if (error) {
                newErrors[info.InfoTemplateID] = error;
            }
        }
    }

    setValidationErrors(newErrors);

    // ✅ If any errors exist, show alert and stop
    if (Object.keys(newErrors).length > 0) {
        const errorMessages = Object.entries(newErrors).map(([id, msg]) => {
            const label = Object.values(subsheetInfo)
                .flat()
                .find(x => x.InfoTemplateID === Number(id))?.LabelEng ?? `Field ${id}`;
            return `Field "${label}": ${msg}`;
        });

        alert(errorMessages.join("\n"));
        setSaving(false);
        return;
    }

    // ✅ Prepare payload from edited info
    const payload: Record<number, { InfoValue: string; UOM: string }> = {};
    for (const [templateIdStr, entry] of Object.entries(editedInfo)) {
        const templateId = Number(templateIdStr);
        const template = Object.values(subsheetInfo).flat().find(info => info.InfoTemplateID === templateId);
        if (!template) continue; // ✅ safeguard
        payload[templateId] = {
            InfoValue: entry.InfoValue,
            UOM: template.TemplateUOM
        };
    }

    // ✅ Send to backend
    try {
        const res = await fetch(`http://localhost:5000/api/backend/datasheets/update-info`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sheetId: parseInt(SheetId),
                infoUpdates: payload
            })
        });

        if (res.ok) {
            alert("✅ Changes saved successfully!");
            await fetchDatasheetAndSubsheets();   // ✅ reload datasheet + subsheets
            await fetchAllInfos();                // ✅ reload information values
            setEditedInfo({});
            setValidationErrors({});
            setIsEditMode(false);
        } else {
            console.error("❌ Save failed:", await res.text());
            alert("Save failed.");
        }
    } catch (err) {
        console.error("❌ Save error:", err);
        alert("An error occurred during save.");
    } finally {
        setSaving(false);
    }
  }

  // ✅ Rendering below
  if (loading) return <p>Loading...</p>;
  if (!datasheet) return <p className="text-center mt-10 text-red-500">Datasheet not found.</p>;

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-screen-2xl">
      {/* Header row: Left = Logo/Title, Right = Export Buttons */}
      <div className="flex justify-between items-start mb-6">
        {/* Left: Client Logo, Sheet Name, Description */}
        <div className="flex items-center space-x-4">
          <Image 
            src={`/clients/${datasheet.ClientLogo ?? 'default-logo.png'}`} 
            alt={datasheet.ClientName ?? 'Client Logo'} 
            width={64} 
            height={64} 
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{datasheet.SheetName}</h1>
            <h2 className="text-lg text-gray-700 dark:text-gray-300">{datasheet.SheetDesc}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{datasheet.SheetDesc2}</p>
          </div>
        </div>
      </div>

      {/* 🆕 Button Row */}
      <div className="flex justify-between items-center mb-4">
        {/* Left buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
                try {
                    await handleExport({
                        sheetId: parseInt(SheetId!),
                        type: "pdf",
                        unitSystem: uom,
                        language: language,
                        sheetName: `${datasheet.ClientName}-${datasheet.SheetName}`, 
                        revisionNum: datasheet.RevisionNum
                    });
                } catch (err) {
                  console.error(err);
                  alert("❌ Export PDF failed");
                }
            }}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition"
            >
              Export PDF
          </button>

          <button
            type="button"
            onClick={async () => {
                try {
                    await handleExport({
                        sheetId: parseInt(SheetId!),
                        type: "excel",
                        unitSystem: uom,
                        language: language,
                        sheetName: `${datasheet.ClientName}-${datasheet.SheetName}`,   // ✅ use ClientName-SheetNameEng
                        revisionNum: datasheet.RevisionNum
                    });
                } catch (err) {
                  console.error(err);
                  alert("❌ Export Excel failed");
                }
              }}
              className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition"
            >
            Export Excel
          </button>
          <button
            onClick={() => setIsEditMode(prev => !prev)}
            className="px-4 py-2 text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition"
          >
              {isEditMode ? "✅ Exit Edit Mode" : "✏️ Enable Edit Mode"}
          </button>
        </div>
        {/* Right buttons */}
        <div className="flex gap-2">
            <select
              title="Language"
              value={selectedLang}
              onChange={(e) => {
                  const selected = e.target.value as "eng" | "fr";
                  setSelectedLang(selected);
                  setLanguage(selected);
              }}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            >
              {languages.map((lang) => (
                <option key={lang.LanguageCode} value={lang.LanguageCode}>
                  {lang.FlagEmoji ?? ""} {lang.LanguageName}
                </option>
              ))}
            </select>
            <button
              onClick={() => setUom(uom === "SI" ? "USC" : "SI")}
              className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition"
            >
              {uom === "SI" ? "📏 USC Units" : "📐 SI Units"}
            </button>
        </div>
      </div>

      {/* Datasheet Details Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{getLabel("SheetDetails")}</h2>
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
          <tbody>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ClientDocNum")}</td>
              <td className="px-4 py-2 border">{datasheet.ClientDocNum}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("CompanyDocNum")}</td>
              <td className="px-4 py-2 border">{datasheet.CompanyDocNum}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ClientProjNum")}</td>
              <td className="px-4 py-2 border">{datasheet.ClientProjNum}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("CompanyProjNum")}</td>
              <td className="px-4 py-2 border">{datasheet.CompanyProjNum}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("AreaID")}</td>
              <td className="px-4 py-2 border">{datasheet.AreaName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("PackageName")}</td>
              <td className="px-4 py-2 border">{datasheet.PackageName}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("RevisionNum")}</td>
              <td className="px-4 py-2 border">{datasheet.RevisionNum}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("RevisionDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.RevisionDate)}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("PreparedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.PreparedBy}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("PreparedByDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.PreparedByDate)}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("VerifiedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.VerifiedBy}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("VerifiedByDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.VerifiedByDate)}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ApprovedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.ApprovedBy}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("ApprovedByDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.ApprovedByDate)}</td>
            </tr>
          </tbody>
        </table>
      </div><br />

      {/* 🔹 Equipment Details Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">{getLabel("EquipmentDetails")}</h2>
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
          <tbody>
            <tr>
              <td className="font-semibold px-4 py-2 border w-1/4">{getLabel("EquipmentName")}</td>
              <td className="px-4 py-2 border">{datasheet.EquipmentName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("EquipSize")}</td>
              <td className="px-4 py-2 border">{datasheet.EquipSize}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("EquipmentTagNum")}</td>
              <td className="px-4 py-2 border">{datasheet.EquipmentTagNum}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("InstallPackNum")}</td>
              <td className="px-4 py-2 border">{datasheet.InstallPackNum}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ServiceName")}</td>
              <td className="px-4 py-2 border">{datasheet.ServiceName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("ModelNumber")}</td>
              <td className="px-4 py-2 border">{datasheet.ModelNumber}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ClientName")}</td>
              <td className="px-4 py-2 border">{datasheet.ClientName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("PID")}</td>
              <td className="px-4 py-2 border">{datasheet.PID}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("Project")}</td>
              <td className="px-4 py-2 border">{datasheet.ProjectName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("CodeStd")}</td>
              <td className="px-4 py-2 border">{datasheet.CodeStd}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("CategoryID")}</td>
              <td className="px-4 py-2 border">{datasheet.CategoryName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("ItemLocation")}</td>
              <td className="px-4 py-2 border">{datasheet.ItemLocation}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ManuID")}</td>
              <td className="px-4 py-2 border">{datasheet.ManuName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("LocationDwg")}</td>
              <td className="px-4 py-2 border">{datasheet.LocationDwg}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("SuppID")}</td>
              <td className="px-4 py-2 border">{datasheet.SuppName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("InstallDwg")}</td>
              <td className="px-4 py-2 border">{datasheet.InstallDwg}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("RequiredQty")}</td>
              <td className="px-4 py-2 border">{datasheet.RequiredQty}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("Driver")}</td>
              <td className="px-4 py-2 border">{datasheet.Driver}</td>
            </tr>
          </tbody>
        </table>
      </div><br />

      {/* Subsheet Sections and Information */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <div className="w-full mt-4">
          {Array.isArray(subsheets) && subsheets.map((sub) => {
            if (!sub || sub.SubID == null) return null;   // ✅ skip invalid sub

            const displaySubSheetName = selectedLang === "eng" 
                ? sub.SubNameEng 
                : translationMap[sub.SubID] ?? sub.SubNameEng;

            const infos = getSubsheetInfos(sub.SubID);

            return (
              <div key={sub.SubID} className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {displaySubSheetName}
                </h3>

                {infos.length > 0 ? (
                  <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="border px-4 py-2">{getLabel("TemplateInfo")}</th>
                        <th className="border px-4 py-2">{getLabel("TemplateValue")}</th>
                        <th className="border px-4 py-2">{getLabel("TemplateUOM")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {infos.map((info) => {
                        const value =
                          uom === "SI"
                            ? info.InfoValue
                            : convertToUSC(info.InfoValue, info.UOM).value;

                        const uomDisplay =
                          uom === "SI" ? info.TemplateUOM : getUSCUnit(info.UOM);

                        const displayTemplateName =
                          selectedLang === "eng"
                            ? info.LabelEng
                            : templateTranslations[info.InfoTemplateID] ?? info.LabelEng;

                        return (
                          <tr key={info.InfoTemplateID}>
                            <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                              {displayTemplateName}
                            </td>
                            <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                              {isEditMode ? (
                                info.Options && info.Options.length > 0 ? (
                                  // ✅ Dropdown for any type if options exist
                                  <select
                                    className="border px-2 py-1 rounded w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    value={value}
                                    onChange={(e) =>
                                      handleValueChange(
                                        sub.SubID.toString(),
                                        info.InfoTemplateID,
                                        "InfoValue",
                                        e.target.value
                                      )
                                    }
                                    aria-label="Select option"
                                  >
                                    <option value="">Select an option</option>
                                    {info.Options.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  // ✅ Text / Number input depending on type
                                  <input
                                    type={
                                      info.InfoType === "int" || info.InfoType === "decimal"
                                        ? "number"
                                        : "text"
                                    }
                                    step={
                                      info.InfoType === "decimal"
                                        ? "0.01"
                                        : info.InfoType === "int"
                                        ? "1"
                                        : undefined
                                    }
                                    className={`border px-2 py-1 rounded w-full ${
                                      validationErrors[info.InfoTemplateID] ? "border-red-500" : ""
                                    }`}
                                    value={value}
                                    onChange={(e) =>
                                      handleValueChange(
                                        sub.SubID.toString(),
                                        info.InfoTemplateID,
                                        "InfoValue",
                                        e.target.value
                                      )
                                    }
                                    placeholder={uomDisplay}
                                    title={validationErrors[info.InfoTemplateID] || ""}
                                  />
                                )
                              ) : (
                                value || "-"
                              )}
                            </td>
                            <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                              {uomDisplay}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500">{getLabel("NoInfo")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Changes Button */}
      {isEditMode && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
              saving ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* ✅ Change Log Viewer (only shows when toggled) */}
      {showLogs && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Change History</h2>
          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 border font-semibold">Field</th>
                <th className="px-4 py-2 border font-semibold">Old</th>
                <th className="px-4 py-2 border font-semibold">New</th>
                <th className="px-4 py-2 border font-semibold">UOM</th>
                <th className="px-4 py-2 border font-semibold">Changed At</th>
                <th className="px-4 py-2 border font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {changeLogs.length > 0 ? (
                changeLogs.map((log) => (
                  <tr key={log.LogID}>
                    <td className="border px-4 py-2">{log.LabelEng}</td>
                    <td className="border px-4 py-2">{log.OldValue}</td>
                    <td className="border px-4 py-2">{log.NewValue}</td>
                    <td className="border px-4 py-2">{log.UOM}</td>
                    <td className="border px-4 py-2">{new Date(log.ChangedAt).toLocaleString()}</td>
                    <td className="border px-4 py-2">{log.ChangedBy}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="border px-4 py-2 text-center text-gray-500">
                    No change logs available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
