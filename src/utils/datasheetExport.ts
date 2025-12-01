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

    const response = await fetch(
      `/api/backend/${sheetType}/export/${sheetId}/${type}?uom=${unitSystem}&lang=${language}`,
      { method: "GET", credentials: "include" }
    );

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`);
    }

    // Default filename
    let filename = `${isTemplate ? "Template" : "FilledSheet"}-${clientName}-${sheetName}-RevNo-${revisionNum}-${unitSystem}-${language}.${type === "pdf" ? "pdf" : "xlsx"}`;

    // Prefer server-provided filename (RFC 5987: filename*=UTF-8'')
    const disposition = response.headers.get("Content-Disposition");
    const re5987 = /filename\*=UTF-8''([^;]+)/;
    const m5987 = re5987.exec(disposition ?? "");
    if (m5987?.[1]) {
      filename = decodeURIComponent(m5987[1]);
    } else {
      // Fallback: plain filename="..."
      const rePlain = /filename="([^"]+)"/;
      const mPlain = rePlain.exec(disposition ?? "");
      if (mPlain?.[1]) {
        filename = mPlain[1];
      }
    }

    const blob = await response.blob();
    saveAs(blob, filename);
  } catch (error) {
    console.error("Export error:", error);
    alert("An error occurred while exporting the datasheet.");
  }
}
