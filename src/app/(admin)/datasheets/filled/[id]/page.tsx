"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { saveAs } from 'file-saver';
import { convertToUSC, convertToSI, getUSCUnit } from '@/utils/unitConversionTable';

// Define types
type Datasheet = {
  SheetNameEng: string;
  SheetNameFr: string;
  SheetDescEng: string;
  SheetDescFr: string;
  SheetName?: string;
  SheetDesc?: string;
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
  RequiredQty: number;
  ItemLocation: string;
  ManuName: string;
  SuppName: string;
  InstallPackNum: string;
  EquipSize: number;
  ModelNumber: string;
  Driver: string;
  LocationDwg: string;
  PID: number;
  InstallDwg: string;
  CodeStd: string;
  ClientName: string;
  ClientLogo: string;
  Status: "Draft" | "Verified" | "Approved";
};

type Subsheet = {
  SubID: string;
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


type LanguageOption = {
  LanguageCode: string;
  LanguageName: string;
  FlagEmoji?: string; // optional, in case some records don't have it
};

type UILabelMap = Record<string, string>;


export default function DatasheetDetailsPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [datasheet, setDatasheet] = useState<Datasheet | null>(null);
  const [subsheets, setSubsheets] = useState<Subsheet[]>([]);
  const [subsheetInfo, setSubsheetInfo] = useState<Record<string, SubsheetInfo[]>>({});
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"eng" | "fr">("eng");
  const [uom, setUom] = useState<"SI" | "USC">("SI");
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [editedInfo, setEditedInfo] = useState<Record<number, Partial<SubsheetInfo>>>({});
  const isDraft = datasheet?.Status === "Draft";
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [selectedLang, setSelectedLang] = useState("eng");
  const [translatedSubsheets, setTranslatedSubsheets] = useState([]);
  const [templateTranslations, setTemplateTranslations] = useState<Record<number, string>>({});
  const [labelTranslations, setLabelTranslations] = useState<UILabelMap>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const searchParams = useSearchParams();
  const showLogsQuery = searchParams?.get("showLogs") === "true";

  useEffect(() => {
    if (showLogsQuery) setShowLogs(true);
  }, [showLogsQuery]);

  useEffect(() => {
    async function loadTranslations() {
      const res = await fetch(`http://localhost:5000/api/datasheets/${id}/subsheets/translated?lang=${selectedLang}`);
      const data = await res.json();
      console.log("🔠 Translated subsheets loaded:", data); // 👈
      setTranslatedSubsheets(data);
    }
    loadTranslations();
  }, [id, selectedLang]);

  useEffect(() => {
    if (!selectedSheetId || selectedLang === "eng") return; // Skip if English or missing sheet ID
  
    async function fetchTemplateTranslations() {
      try {
        const res = await fetch(`http://localhost:5000/api/datasheets/templates/${selectedSheetId}/translations?lang=${selectedLang}`)
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
  }, [selectedLang, selectedSheetId]);

  // ✅ Build map once translations are loaded
  const translationMap = useMemo(() => {
    const map: Record<string, string> = {};
    translatedSubsheets.forEach((item: { SubID: number; SubName: string }) => {
      map[item.SubID.toString()] = item.SubName;
    });
    return map;
  }, [translatedSubsheets]);
  
  useEffect(() => {
    async function fetchLogs() {
      const res = await fetch(`http://localhost:5000/api/datasheets/${selectedSheetId}/change-logs`);
      const data = await res.json();
      setChangeLogs(data);
    }
  
    if (showLogs) fetchLogs();
  }, [showLogs, selectedSheetId]);

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
  
  // Fetch datasheet details
  useEffect(() => {
    async function fetchDatasheetAndRevisions() {
      try {
        const response = await fetch(`http://localhost:5000/api/datasheets/detail/${id}?lang=${selectedLang}`);
        const data = await response.json();
        setDatasheet(data);
        if (id) {
          setSelectedSheetId(id);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading datasheet or revisions:", error);
        setLoading(false);
      }
    }
  
    fetchDatasheetAndRevisions();
  }, [id, selectedLang]); // 👈 include selectedLang here

  // When user switches revision, reload that revision
  useEffect(() => {
    if (!selectedSheetId) return;

    async function fetchSelectedRevisionData() {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/datasheets/detail/${selectedSheetId}?lang=${selectedLang}`);
      const data = await response.json();
      setDatasheet(data);
      setLoading(false);
    }

    fetchSelectedRevisionData();
  }, [selectedSheetId, selectedLang]);

  // Fetch subsheets under this datasheet
  useEffect(() => {
    async function fetchSubsheets() {
      try {
        const response = await fetch(`http://localhost:5000/api/datasheets/${id}/subsheets`);
        const data: Subsheet[] = await response.json();
        setSubsheets(data);
        if (data.length > 0) {
          setActiveTab(data[0].SubID); // Set first subsheet as default tab
        }
      } catch (error) {
        console.error("Error fetching subsheets:", error);
      }
    }
    fetchSubsheets();
  }, [id]);

  // Fetch subsheet information
  useEffect(() => {
    if (!selectedSheetId || !subsheets || subsheets.length === 0) return;
  
    const fetchAllInfos = async () => {
      const infoData: Record<string, SubsheetInfo[]> = {};
  
      for (const sub of subsheets) {
        if (!sub?.SubID) continue;
  
        try {
          const response = await fetch(
            `http://localhost:5000/api/datasheets/subsheets/${sub.SubID}/sheet/${selectedSheetId}/info`
          );
          const data: SubsheetInfo[] = await response.json();
          console.log("✅ Info loaded for", sub.SubID, data);
          infoData[sub.SubID] = data;
        } catch (error) {
          console.error("❌ Failed to fetch info for SubID:", sub.SubID, error);
        }
      }
  
      setSubsheetInfo(infoData);
    };
  
    fetchAllInfos();
  }, [subsheets, selectedSheetId]);
  

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!datasheet) return <p className="text-center mt-10 text-red-500">Datasheet not found.</p>;

  // Function to download Excel or PDF file
  const handleExport = async (type: "pdf" | "excel") => {
    try {
      const response = await fetch(`http://localhost:5000/api/datasheets/${id}/export/${type}?uom=${uom}&lang=${language}`);
      const blob = await response.blob();
  
      let extension = type === "pdf" ? "pdf" : "xlsx";
      let filename = `${datasheet.ClientName}-${datasheet.SheetNameEng}-RevNo-${datasheet.RevisionNum}-${uom}-${language}.${extension}`;
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+?)"/);
      if (match?.[1]) filename = match[1];
  
      saveAs(blob, filename);
    } catch (error) {
      console.error("Error exporting datasheet:", error);
    }
  };
  //console.log("📤 Exporting", { id, type, uom, language });
  

  // ✅ Place the formatDate function here
  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function validateField(value: string, uom: string): string | null {
    if (uom && isNaN(Number(value))) {
      return "Must be a numeric value for measured entries";
    }
    if (!value.trim()) {
      return "Value is required";
    }
    return null;
  }

  function handleValueChange(templateId: number, field: string, value: string) {
    // Update view state
    setSubsheetInfo((prev) => {
      const updated = { ...prev };
      const infoList = updated[activeTab!] || [];
  
      updated[activeTab!] = infoList.map((info) =>
        info.InfoTemplateID === templateId ? { ...info, [field]: value } : info
      );
  
      return updated;
    });
  
    // Track edits for saving
    setEditedInfo((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        [field]: value,
      },
    }));
  }

  function preparePayload(infoUpdates: Record<number, { InfoValue: string; UOM: string }>) {
    const convertedUpdates: Record<number, { InfoValue: string; UOM: string }> = {};
  
    for (const [templateId, entry] of Object.entries(infoUpdates)) {
      const id = Number(templateId);
      if (uom === "USC") {
        const { value: siValue, unit: siUnit } = convertToSI(entry.InfoValue, entry.UOM);
        convertedUpdates[id] = { InfoValue: siValue, UOM: siUnit };
      } else {
        convertedUpdates[id] = { InfoValue: entry.InfoValue, UOM: entry.UOM };
      }
    }
  
    return convertedUpdates;
  }

  function isValidEntry(value: string, uom: string | null): boolean {
    if (!value?.trim()) return false;
    if (uom && isNaN(Number(value))) return false;
    return true;
  }
  
  async function handleSave() {
    const hasErrors = Object.values(validationErrors).some((err) => err);
    if (hasErrors) {
      alert("Please fix validation errors before saving.");
      return;
    }

    if (!selectedSheetId || Object.keys(editedInfo).length === 0) {
      alert("No changes to save.");
      return;
    }

    // Validate first
    for (const [templateId, update] of Object.entries(editedInfo)) {
      const val = update.InfoValue ?? "";
      const uom = update.UOM ?? "";
      if (!isValidEntry(val, uom)) {
        alert(`🚫 Invalid input for field ID ${templateId}. Please enter a valid value.`);
        return;
      }
    }
  
    const payload = {
      sheetId: parseInt(selectedSheetId),
      infoUpdates: preparePayload(editedInfo), // ✅ apply conversion here
    };
  
    try {
      const res = await fetch(`http://localhost:5000/api/datasheets/update-info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (res.ok) {
        alert("Changes saved successfully!");
        setEditedInfo({});
      } else {
        console.error("❌ Save failed:", await res.text());
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("An error occurred while saving.");
    }
  }

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-screen-2xl">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          {/* Toggle Language & UOM */}
          <div className="flex justify-end space-x-4 mb-4">
            <select
              title="Language"
              value={selectedLang}
              onChange={(e) => {
                const selected = e.target.value;
                setSelectedLang(selected);
                setLanguage(selected); // 👈 Optional: keep both in sync
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

      {/* Header row: Left = Logo/Title, Right = Export Buttons */}
      <div className="flex justify-between items-start mb-6">
        {/* Left: Client Logo, Sheet Name, Description */}
        <div className="flex items-center space-x-4">
          <img src={`/clients/${datasheet.ClientLogo}`} alt={datasheet.ClientName} className="w-16 h-16 rounded-lg" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{datasheet.SheetName}</h1>
            <h2 className="text-lg text-gray-700 dark:text-gray-300">{datasheet.SheetDesc}</h2>
          </div>
        </div>

        {/* Put export buttons here */}
        <div className="flex items-center space-x-2">
          <button
              onClick={() => handleExport("pdf")}
              className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition"
          >
              Export to PDF
          </button>

          <button
              onClick={() => handleExport("excel")}
              className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition"
          >
              Export to Excel
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
              <td className="font-semibold px-4 py-2 border">{getLabel("VerifiedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.VerifiedBy}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("RevisionDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.RevisionDate)}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("VerifiedByDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.VerifiedByDate)}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("PreparedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.PreparedBy}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("ApprovedByID")}</td>
              <td className="px-4 py-2 border">{datasheet.ApprovedBy}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("PreparedByDate")}</td>
              <td className="px-4 py-2 border">{formatDate(datasheet.PreparedByDate)}</td>
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
              <td className="font-semibold px-4 py-2 border">{getLabel("EquipmentTagNum")}</td>
              <td className="px-4 py-2 border">{datasheet.EquipmentTagNum}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ClientName")}</td>
              <td className="px-4 py-2 border">{datasheet.ClientName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("EquipSize")}</td>
              <td className="px-4 py-2 border">{datasheet.EquipSize}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ServiceName")}</td>
              <td className="px-4 py-2 border">{datasheet.ServiceName}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("ModelNumber")}</td>
              <td className="px-4 py-2 border">{datasheet.ModelNumber}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("RequiredQty")}</td>
              <td className="px-4 py-2 border">{datasheet.RequiredQty}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("Driver")}</td>
              <td className="px-4 py-2 border">{datasheet.Driver}</td>
            </tr>
            <tr>
              <td className="font-semibold px-4 py-2 border">{getLabel("ItemLocation")}</td>
              <td className="px-4 py-2 border">{datasheet.ItemLocation}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("PID")}</td>
              <td className="px-4 py-2 border">{datasheet.PID}</td>
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
              <td className="font-semibold px-4 py-2 border">{getLabel("InstallPackNum")}</td>
              <td className="px-4 py-2 border">{datasheet.InstallPackNum}</td>
              <td className="font-semibold px-4 py-2 border">{getLabel("CodeStd")}</td>
              <td className="px-4 py-2 border">{datasheet.CodeStd}</td>
            </tr>
          </tbody>
        </table>
      </div><br />

      {/* Subsheet Tabs and Information */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <div className="w-full mt-4">
          <div className="border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
            <ul className="flex space-x-1 whitespace-nowrap overflow-x-auto scrollbar-thin scrollbar-thumb-gray-500 dark:scrollbar-thumb-gray-700">
            {Array.isArray(subsheets) && subsheets.map((sub) => {
              const displaySubSheetName = 
                selectedLang === "eng" 
                ? sub.SubNameEng 
                : translationMap[sub.SubID] ?? sub.SubNameEng;

              return (
                <li key={sub.SubID}>
                  <button
                    onClick={() => setActiveTab(sub.SubID)}
                    className={`px-4 py-2 rounded-md transition-all duration-200 ${
                      activeTab === sub.SubID ? "bg-blue-500 text-white" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    {displaySubSheetName}
                  </button>
                </li>
              );
            })}

            </ul>
          </div>

          <div className="p-4">
          {activeTab !== null && subsheetInfo[activeTab] ? (
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border px-4 py-2">{getLabel("TemplateInfo")}</th>
                  <th className="border px-4 py-2">{getLabel("TemplateValue")}</th>
                  <th className="border px-4 py-2">{getLabel("TemplateUOM")}</th>
                </tr>
              </thead>
              <tbody>
                {activeTab !== null && Array.isArray(subsheetInfo[activeTab]) ? (
                  subsheetInfo[activeTab].map((info) => {
                    const value =
                      uom === "SI"
                        ? info.InfoValue
                        : convertToUSC(info.InfoValue, info.UOM).value;

                    const uomDisplay =
                      uom === "SI" ? info.UOM : getUSCUnit(info.UOM);

                    const displayTemplateName =
                      selectedLang === "eng"
                        ? info.LabelEng
                        : templateTranslations[info.InfoTemplateID] ?? info.LabelEng;

                    const handleInputChange = (newVal: string) => {
                      const finalValue = uom === "SI"
                        ? newVal
                        : convertToSI(newVal, info.UOM).value;
                    
                      const updatedUOM = uom === "SI"
                        ? info.UOM
                        : convertToSI(newVal, info.UOM).unit;
                    
                      // ✅ Run validation and set error message
                      const errorMsg = validateField(newVal, info.UOM);
                      setValidationErrors((prev) => ({
                        ...prev,
                        [info.InfoTemplateID]: errorMsg || ""
                      }));
                    
                      // ✅ Update current display and edited info
                      setSubsheetInfo((prev) => {
                        const updated = { ...prev };
                        const list = updated[activeTab!] || [];
                        updated[activeTab!] = list.map((item) =>
                          item.InfoTemplateID === info.InfoTemplateID
                            ? { ...item, InfoValue: finalValue, UOM: updatedUOM }
                            : item
                        );
                        return updated;
                      });
                    
                      setEditedInfo((prev) => ({
                        ...prev,
                        [info.InfoTemplateID]: {
                          InfoValue: finalValue,
                          UOM: updatedUOM,
                        },
                      }));
                    };

                    return (
                      <tr key={info.InfoTemplateID}>
                        <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                          {displayTemplateName}
                        </td>
                        <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                          {isDraft ? (
                            <input
                              type="text"
                              className={`border px-2 py-1 rounded w-full ${validationErrors[info.InfoTemplateID] ? "border-red-500" : ""}`}
                              value={value}
                              onChange={(e) => handleInputChange(e.target.value)}
                              placeholder={uomDisplay}
                              title={validationErrors[info.InfoTemplateID] || ""}
                            />
                          
                          ) : (
                            value
                          )}
                        </td>
                        <td className="border px-4 py-2 text-gray-900 dark:text-gray-100">
                          {uomDisplay}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="border px-4 py-2 text-center text-gray-500">{getLabel("NoInfo")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
                <p className="text-gray-500">{getLabel("NoInfo")}</p>
          )}
          </div>
          {isDraft && (
            <div className="p-4">
              <button
                onClick={handleSave}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Changes
              </button>

              {/* 🔽 Add this below Save button */}
              <button
                onClick={() => setShowLogs((prev) => !prev)}
                className="mt-2 ml-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
              >
                {showLogs ? "Hide Change Log" : "View Change Log"}
              </button>
            </div>
          )}
        </div>
      </div>

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
