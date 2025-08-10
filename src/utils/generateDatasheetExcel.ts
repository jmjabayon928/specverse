// src/utils/generateDatasheetExcel.ts
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { UnifiedSheet } from "@/types/sheet";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";
import { getLabel } from "@/utils/translationUtils";
import { translations } from "@/constants/translations";

type ExcelOptions = {
  notes?: SheetNoteDTO[];
  attachments?: AttachmentDTO[];
};

export async function generateDatasheetExcel(
  sheet: UnifiedSheet,
  lang: string,
  uom: "SI" | "USC",
  options?: ExcelOptions
): Promise<Buffer> {
  const notes = options?.notes ?? [];
  const attachments = options?.attachments ?? [];

  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet("Datasheet", {
    views: [{ state: "frozen", ySplit: 0 }]
  });
  sheet1.properties.defaultColWidth = 15;

  const labelStyle: Partial<ExcelJS.Style> = {
    font: { size: 10, bold: true },
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
  };

  const valueStyle: Partial<ExcelJS.Style> = {
    font: { size: 10 },
    alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    border: { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }
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
      sheet1.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 60 } });
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

  // ====== NEW: Notes section ======
  const groupSpacer1 = sheet1.getRow(rowIndex++);
  sheet1.mergeCells(`A${groupSpacer1.number}:H${groupSpacer1.number}`);

  const notesHeader = sheet1.getRow(rowIndex++);
  notesHeader.getCell("A").value = getLabel("Notes", uiMap);
  notesHeader.getCell("A").font = { size: 12, bold: true };
  sheet1.mergeCells(`A${notesHeader.number}:H${notesHeader.number}`);

  const notesTableHeader = sheet1.getRow(rowIndex++);
  notesTableHeader.getCell("A").value = getLabel("NoteType", uiMap) || "Note Type";
  notesTableHeader.getCell("C").value = getLabel("Order", uiMap) || "Order";
  notesTableHeader.getCell("E").value = getLabel("NoteText", uiMap) || "Note Text";
  sheet1.mergeCells(`A${notesTableHeader.number}:B${notesTableHeader.number}`);
  sheet1.mergeCells(`C${notesTableHeader.number}:D${notesTableHeader.number}`);
  sheet1.mergeCells(`E${notesTableHeader.number}:H${notesTableHeader.number}`);
  notesTableHeader.getCell("A").style = labelStyle;
  notesTableHeader.getCell("C").style = labelStyle;
  notesTableHeader.getCell("E").style = labelStyle;

  if (notes.length === 0) {
    const row = sheet1.getRow(rowIndex++);
    row.getCell("A").value = "No notes.";
    sheet1.mergeCells(`A${row.number}:H${row.number}`);
  } else {
    const sorted = [...notes].sort(
      (a, b) =>
        (a.NoteType ?? String(a.NoteTypeID)).localeCompare(b.NoteType ?? String(b.NoteTypeID)) ||
        a.OrderIndex - b.OrderIndex ||
        a.NoteID - b.NoteID
    );
    for (const n of sorted) {
      const row = sheet1.getRow(rowIndex++);
      row.getCell("A").value = n.NoteType ?? String(n.NoteTypeID);
      row.getCell("A").style = valueStyle;
      sheet1.mergeCells(`A${row.number}:B${row.number}`);

      row.getCell("C").value = n.OrderIndex ?? 0;
      row.getCell("C").style = valueStyle;
      sheet1.mergeCells(`C${row.number}:D${row.number}`);

      row.getCell("E").value = n.NoteText ?? "";
      row.getCell("E").style = valueStyle;
      sheet1.mergeCells(`E${row.number}:H${row.number}`);
    }
  }

  // ====== NEW: Attachments section ======
  const groupSpacer2 = sheet1.getRow(rowIndex++);
  sheet1.mergeCells(`A${groupSpacer2.number}:H${groupSpacer2.number}`);

  const attHeader = sheet1.getRow(rowIndex++);
  attHeader.getCell("A").value = getLabel("Attachments", uiMap);
  attHeader.getCell("A").font = { size: 12, bold: true };
  sheet1.mergeCells(`A${attHeader.number}:H${attHeader.number}`);

  const images = attachments.filter((a) => a.MimeType.startsWith("image/"));
  const pdfs   = attachments.filter((a) => a.MimeType === "application/pdf");
  const others = attachments.filter((a) => !a.MimeType.startsWith("image/") && a.MimeType !== "application/pdf");

  const addAttachmentGroup = (title: string, list: AttachmentDTO[]) => {
    const h = sheet1.getRow(rowIndex++);
    h.getCell("A").value = `${title} (${list.length})`;
    h.getCell("A").font = { bold: true };
    sheet1.mergeCells(`A${h.number}:H${h.number}`);

    const th = sheet1.getRow(rowIndex++);
    th.getCell("A").value = "File Name";
    th.getCell("C").value = "MIME Type";
    th.getCell("E").value = "Size (bytes)";
    th.getCell("G").value = "Link";
    sheet1.mergeCells(`A${th.number}:B${th.number}`);
    sheet1.mergeCells(`C${th.number}:D${th.number}`);
    sheet1.mergeCells(`E${th.number}:F${th.number}`);
    sheet1.mergeCells(`G${th.number}:H${th.number}`);
    th.getCell("A").style = labelStyle;
    th.getCell("C").style = labelStyle;
    th.getCell("E").style = labelStyle;
    th.getCell("G").style = labelStyle;

    if (list.length === 0) {
      const r = sheet1.getRow(rowIndex++);
      r.getCell("A").value = "None";
      sheet1.mergeCells(`A${r.number}:H${r.number}`);
      return;
    }

    for (const a of list) {
      const r = sheet1.getRow(rowIndex++);
      r.getCell("A").value = a.FileName;
      r.getCell("A").style = valueStyle;
      sheet1.mergeCells(`A${r.number}:B${r.number}`);

      r.getCell("C").value = a.MimeType;
      r.getCell("C").style = valueStyle;
      sheet1.mergeCells(`C${r.number}:D${r.number}`);

      r.getCell("E").value = a.SizeBytes ?? 0;
      r.getCell("E").style = valueStyle;
      sheet1.mergeCells(`E${r.number}:F${r.number}`);

      // Hyperlink to view endpoint
      r.getCell("G").value = { text: "Open", hyperlink: a.Url };
      r.getCell("G").font = { color: { argb: "FF1D4ED8" }, underline: true, size: 10 };
      sheet1.mergeCells(`G${r.number}:H${r.number}`);
    }
  };

  addAttachmentGroup("Images", images);
  addAttachmentGroup("PDFs", pdfs);
  addAttachmentGroup("Other Files", others);

  // Footer
  sheet1.headerFooter.oddFooter =
    '&CGenerated by SpecVerse | © Jeff Martin Abayon, 2025 | www.github.com/jmjabayon928/specverse';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
