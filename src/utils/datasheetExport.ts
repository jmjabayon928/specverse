// src/utils/datasheetExport.ts
import { saveAs } from "file-saver";

type ExportOptions = {
  sheetId: number;
  type: "pdf" | "excel";
  unitSystem: "SI" | "USC";
  language: string;
  sheetName: string;
  revisionNum: number;
  clientName: string;
  isTemplate: boolean;
};

export async function handleExport({
  sheetId,
  type,
  unitSystem,
  language,
  sheetName,
  revisionNum,
  clientName,
  isTemplate,
}: ExportOptions) {
  try {
    const sheetType = isTemplate ? "templates" : "filledsheets";

    // ✅ Match backend route style: /export/:id/pdf
    const response = await fetch(
      `/api/backend/${sheetType}/export/${sheetId}/${type}?uom=${unitSystem}&lang=${language}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }

    // ✅ Fallback filename
    let filename = `${isTemplate ? "Template" : "FilledSheet"}-${clientName}-${sheetName}-RevNo-${revisionNum}-${unitSystem}-${language}.${type === "pdf" ? "pdf" : "xlsx"}`;

    // ✅ Use server-provided filename if available
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.includes("filename*=")) {
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
    }

    const blob = await response.blob();
    saveAs(blob, filename);
  } catch (error) {
    console.error("Export error:", error);
    alert("An error occurred while exporting the datasheet.");
  }
}
