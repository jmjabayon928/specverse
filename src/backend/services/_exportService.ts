// src/backend/services/exportService.ts
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import { getFilledSheetDetailsById } from "@/backend/services/filledSheetService";
import { getLabel } from "@/utils/translationUtils";
import { translations } from "@/constants/translations";
import type { UnifiedSheet, UnifiedSubsheet } from "@/domain/datasheets/sheetTypes";

interface DatasheetPDFExport {
  buffer: Buffer;
  fileName: string;
}

export async function generateDatasheetPDF(
  sheetId: number,
  uom: "SI" | "USC",
  lang: string = "eng"
): Promise<DatasheetPDFExport> {
  const result = await getFilledSheetDetailsById(sheetId, lang, uom);
  if (!result) throw new Error(`Sheet with ID ${sheetId} not found.`);
  const sheet: UnifiedSheet = result.datasheet;

  // Build UI label map
  const uiMap: Record<string, string> = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [key, value[lang] ?? key])
  );
  const getUI = (key: string) => getLabel(key, uiMap);

  // Read logo
  const logoPath = path.resolve("public/logo.png");
  const logoBase64 = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath).toString("base64")
    : "";

  const equipmentRows = `
    <tr><td><b>${getUI("equipmentName")}</b></td><td>${sheet.equipmentName}</td></tr>
    <tr><td><b>${getUI("equipmentTagNum")}</b></td><td>${sheet.equipmentTagNum}</td></tr>
    <tr><td><b>${getUI("serviceName")}</b></td><td>${sheet.serviceName}</td></tr>
    <tr><td><b>${getUI("requiredQty")}</b></td><td>${sheet.requiredQty}</td></tr>
    <tr><td><b>${getUI("itemLocation")}</b></td><td>${sheet.itemLocation}</td></tr>
  `;

  const buildSubsheetTable = (subsheet: UnifiedSubsheet) => {
    const rows = subsheet.fields
      .map((field) => {
        const label = field.label;
        const uomLabel = field.uom ?? "";
        const options = field.options?.join(", ") || "";
        const value = field.value ?? "";
        const requiredStar = field.required ? " <span style='color:red'>*</span>" : "";

        return `
          <tr>
            <td>${label}${requiredStar}</td>
            <td>${uomLabel}</td>
            <td>${options}</td>
            <td>${value}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <h3>${subsheet.name}</h3>
      <table style="width:100%; border-collapse: collapse;" border="1">
        <thead>
          <tr style="background-color:#f2f2f2;">
            <th>${getUI("label")}</th>
            <th>${getUI("uom")}</th>
            <th>${getUI("options")}</th>
            <th>${getUI("value")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2, h3 { color: #333; }
        table { margin-bottom: 30px; }
        th, td { padding: 8px; text-align: left; }
        .logo { max-height: 60px; }
      </style>
    </head>
    <body>
      <table style="width:100%; margin-bottom:20px;">
        <tr>
          <td><img src="data:image/png;base64,${logoBase64}" class="logo" /></td>
          <td style="text-align:right;">
            <h1>${sheet.sheetName}</h1>
            <p>${sheet.sheetDesc}</p>
            <p><b>${getUI("revisionNum")}:</b> ${(sheet.engineeringRevision?.trim() ?? "") || String(sheet.revisionNum ?? "")}</p>
            <p><b>${getUI("preparedBy")}:</b> ${sheet.preparedByName} (${sheet.preparedByDate})</p>
          </td>
        </tr>
      </table>

      <h2>${getUI("equipmentDetails")}</h2>
      <table style="width:100%; border-collapse: collapse;" border="1">
        ${equipmentRows}
      </table>

      ${sheet.subsheets.map(buildSubsheetTable).join("")}
    </body>
    </html>
  `;

  // Use Puppeteer to convert HTML to PDF
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });

  await browser.close();

  const fileName = `${sheet.sheetName.replaceAll(/\s+/g, "_")}_${sheet.sheetId}.pdf`;

  return {
    buffer: Buffer.from(pdfBuffer.buffer), // ✅ fix type error
    fileName,
  };
}

export async function generateDatasheetExcel(
  sheetId: number,
  uom: "SI" | "USC",
  lang: string = "eng"
): Promise<Buffer> {
  const result = await getFilledSheetDetailsById(sheetId, lang, uom);
  if (!result) throw new Error(`Sheet with ID ${sheetId} not found.`);
  const sheet = result.datasheet;

  const uiMap: Record<string, string> = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [key, value[lang] ?? key])
  );
  const getUI = (key: string) => getLabel(key, uiMap);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Datasheet");

  worksheet.addRow([
    getUI("InfoLabel"),
    getUI("InfoUOM"),
    getUI("InfoOptions"),
    getUI("InfoValue"),
  ]);

  for (const subsheet of sheet.subsheets) {
    worksheet.addRow([subsheet.name]); // Subsheet title
    for (const field of subsheet.fields) {
      worksheet.addRow([
        field.label,
        field.uom || "",
        field.options?.join(", ") || "",
        field.value ?? "",
      ]);
    }
    worksheet.addRow([]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}