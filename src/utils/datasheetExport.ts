// src/utils/datasheetExport.ts
import { saveAs } from "file-saver";

type ExportOptions = {
  sheetId: number;
  type: "pdf" | "excel";
  unitSystem: "SI" | "USC";
  language: string;
  sheetName: string;
  revisionNum: number;
};

export async function handleExport({
  sheetId,
  type,
  unitSystem,
  language,
  sheetName,
  revisionNum,
}: ExportOptions) {
  try {
    const response = await fetch(
      `/api/backend/datasheets/${sheetId}/export/${type}?uom=${unitSystem}&lang=${language}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const extension = type === "pdf" ? "pdf" : "xlsx";
    const filename = `${sheetName}-Rev-${revisionNum}-${unitSystem}-${language}.${extension}`;

    saveAs(blob, filename);
  } catch (error) {
    console.error("Export error:", error);
    alert("An error occurred while exporting the datasheet.");
  }
}
