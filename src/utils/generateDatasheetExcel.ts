// src/utils/generateDatasheetExcel.ts
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { UnifiedSheet } from "@/types/sheet";
import { getLabel } from "@/utils/translationUtils";
import { translations } from "@/constants/translations";

export async function generateDatasheetExcel(
  sheet: UnifiedSheet,
  lang: string,
  uom: "SI" | "USC"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet("Datasheet", {
    views: [{ state: "frozen", ySplit: 0 }]
  });
  sheet1.properties.defaultColWidth = 15;

  const labelStyle: Partial<ExcelJS.Style> = {
    font: { size: 10, bold: true },
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    }
  };

  const valueStyle: Partial<ExcelJS.Style> = {
    font: { size: 10 },
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    }
  };

  const uiMap: Record<string, string> = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [key, value[lang] ?? key])
  );

  sheet1.columns = new Array(8).fill({ width: 15 });

  try {
    const logoPath = path.resolve(`./public/clients/${sheet.clientLogo ?? ""}`);
    if (fs.existsSync(logoPath)) {
      const imageExt = path.extname(logoPath).substring(1).toLowerCase() as "png" | "jpeg";
      const imageId = workbook.addImage({
        buffer: fs.readFileSync(logoPath) as unknown as ExcelJS.Buffer,
        extension: imageExt,
      });
      sheet1.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 60 }
      });
    }
  } catch (err) {
    console.error("Error inserting logo:", err);
  }

  sheet1.mergeCells("C1:H1");
  sheet1.mergeCells("C2:H2");
  sheet1.mergeCells("C3:H3");
  sheet1.mergeCells("C4:H4");

  sheet1.getCell("C1").value = `${getLabel(sheet.status ?? "", uiMap)} – ${sheet.sheetName ?? ""}`;
  sheet1.getCell("C1").font = { size: 12, bold: true };
  sheet1.getCell("C1").alignment = { vertical: "middle", horizontal: "left" };

  sheet1.getCell("C2").value = sheet.sheetDesc ?? "";
  sheet1.getCell("C2").font = { size: 11, bold: true };
  sheet1.getCell("C2").alignment = { vertical: "middle", horizontal: "left" };

  sheet1.getCell("C3").value = sheet.sheetDesc2 ?? "";
  sheet1.getCell("C3").font = { size: 10 };
  sheet1.getCell("C3").alignment = { vertical: "middle", horizontal: "left" };

  let rowIndex = 6;

  const addDetailSection = (
    title: string,
    rows: [string, string | number | null | undefined, string, string | number | null | undefined][]
  ) => {
    const headerRow = sheet1.getRow(rowIndex++);
    headerRow.getCell("A").value = title;
    headerRow.getCell("A").font = { size: 12, bold: true };
    sheet1.mergeCells(`A${headerRow.number}:B${headerRow.number}`);

    for (const [label1, value1, label2, value2] of rows) {
      const row = sheet1.getRow(rowIndex++);
      row.getCell("A").value = getLabel(label1, uiMap);
      row.getCell("A").style = labelStyle;
      sheet1.mergeCells(`A${row.number}:B${row.number}`);

      row.getCell("C").value = value1 ?? "-";
      row.getCell("C").style = valueStyle;
      sheet1.mergeCells(`C${row.number}:D${row.number}`);

      row.getCell("E").value = getLabel(label2, uiMap);
      row.getCell("E").style = labelStyle;
      sheet1.mergeCells(`E${row.number}:F${row.number}`);

      row.getCell("G").value = value2 ?? "-";
      row.getCell("G").style = valueStyle;
      sheet1.mergeCells(`G${row.number}:H${row.number}`);
    }
  };

  addDetailSection(getLabel("Datasheet Details", uiMap), [
    ["sheetName", sheet.sheetName, "sheetDesc", sheet.sheetDesc],
    ["sheetDesc2", sheet.sheetDesc2, "clientDocNum", sheet.clientDocNum],
    ["clientProjectNum", sheet.clientProjectNum, "companyDocNum", sheet.companyDocNum],
    ["companyProjectNum", sheet.companyProjectNum, "areaName", sheet.areaName],
    ["packageName", sheet.packageName, "revisionNum", sheet.revisionNum],
    ["revisionDate", sheet.revisionDate, "preparedByName", sheet.preparedByName],
    ["preparedByDate", sheet.preparedByDate, "modifiedByName", sheet.modifiedByName],
    ["modifiedByDate", sheet.modifiedByDate, "rejectedByName", sheet.rejectedByName],
    ["rejectedByDate", sheet.rejectedByDate, "rejectComment", sheet.rejectComment],
    ["verifiedByName", sheet.verifiedByName, "verifiedByDate", sheet.verifiedDate],
    ["approvedByName", sheet.approvedByName, "approvedByDate", sheet.approvedDate],
  ]);

  const spacerRow = sheet1.getRow(rowIndex++);
  sheet1.mergeCells(`A${spacerRow.number}:H${spacerRow.number}`);

  addDetailSection(getLabel("Equipment Details", uiMap), [
    ["equipmentName", sheet.equipmentName, "equipmentTagNum", sheet.equipmentTagNum],
    ["serviceName", sheet.serviceName, "requiredQty", sheet.requiredQty],
    ["itemLocation", sheet.itemLocation, "manuName", sheet.manuName],
    ["suppName", sheet.suppName, "installPackNum", sheet.installPackNum],
    ["equipSize", sheet.equipSize, "modelNum", sheet.modelNum],
    ["driver", sheet.driver, "pid", sheet.pid],
    ["installDWG", sheet.installDwg, "codeStandard", sheet.codeStd],
    ["categoryName", sheet.categoryName, "clientName", sheet.clientName],
    ["projectName", sheet.projectName, "", ""]
  ]);

  for (const subsheet of sheet.subsheets) {
    const emptyRow = sheet1.getRow(rowIndex++);
    sheet1.mergeCells(`A${emptyRow.number}:H${emptyRow.number}`);

    const header = sheet1.getRow(rowIndex++);
    header.getCell("A").value = getLabel(subsheet.name, uiMap);
    header.getCell("A").font = { size: 12, bold: true };
    sheet1.mergeCells(`A${header.number}:H${header.number}`);

    const tableHeader = sheet1.getRow(rowIndex++);
    tableHeader.getCell("A").value = getLabel("label", uiMap);
    tableHeader.getCell("C").value = getLabel("options", uiMap);
    tableHeader.getCell("E").value = getLabel("value", uiMap);
    tableHeader.getCell("G").value = getLabel("uom", uiMap);
    sheet1.mergeCells(`A${tableHeader.number}:B${tableHeader.number}`);
    sheet1.mergeCells(`C${tableHeader.number}:D${tableHeader.number}`);
    sheet1.mergeCells(`E${tableHeader.number}:F${tableHeader.number}`);
    sheet1.mergeCells(`G${tableHeader.number}:H${tableHeader.number}`);

    tableHeader.getCell("A").style = labelStyle;
    tableHeader.getCell("C").style = labelStyle;
    tableHeader.getCell("E").style = labelStyle;
    tableHeader.getCell("G").style = labelStyle;

    for (const field of subsheet.fields) {
      const row = sheet1.getRow(rowIndex++);
      row.getCell("A").value = getLabel(field.label, uiMap);
      row.getCell("A").style = labelStyle;
      sheet1.mergeCells(`A${row.number}:B${row.number}`);

      row.getCell("C").value = field.options?.join(", ") ?? "-";
      row.getCell("C").style = valueStyle;
      sheet1.mergeCells(`C${row.number}:D${row.number}`);

      row.getCell("E").value = field.value ?? "-";
      row.getCell("E").style = valueStyle;
      sheet1.mergeCells(`E${row.number}:F${row.number}`);

      row.getCell("G").value = field.uom ?? "-";
      row.getCell("G").style = valueStyle;
      sheet1.mergeCells(`G${row.number}:H${row.number}`);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
