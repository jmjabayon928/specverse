// @ts-ignore
import * as pdf from "html-pdf-node";
import * as os from "os";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import { getDatasheetById } from "../database/datasheetQueries";
import { getSubSheetsBySheetId } from "../database/subsheetQueries";
import { getInformationBySubSheetId } from "../database/informationQueries"; // We'll update this
import { convertToUSC, getUSCUnit } from "../../utils/unitConversionTable";
import { getUILabelTranslations } from "../../utils/labelTranslation";
import { getTranslatedSubSheets } from "../database/subsheetQueries";
import { getTranslatedTemplateLabels } from "../database/informationQueries";

/**
 * Generate PDF for a datasheet using html-pdf-node
 */
type SubsheetInfo = {
  InfoTemplateID: number;
  LabelEng: string;
  InfoValue: string;
  UOM: string;
};

export async function generateDatasheetPDF(sheetId: string, uom: "SI" | "USC", lang: string = "eng"): Promise<Buffer> {
  console.log("📄 generateDatasheetPDF triggered for sheetId:", sheetId, "| UOM:", uom, "| Language:", lang);

  try {
    const datasheet = await getDatasheetById(sheetId);
    if (!datasheet) throw new Error("Datasheet not found");

    const subsheets = await getSubSheetsBySheetId(Number(sheetId));
    const labels = await getUILabelTranslations(lang);
    const translatedSubsheetRows = await getTranslatedSubSheets(Number(sheetId), lang);
    const templateMap = await getTranslatedTemplateLabels(Number(sheetId), lang);
    console.log("🌐 Template Label Translations:", templateMap);
    if (Object.keys(templateMap).length === 0) {
      console.warn("⚠️ No translated template labels loaded for lang =", lang);
    }

    const translatedSubsheets: Record<number, string> = {};
    translatedSubsheetRows.forEach(row => {
      translatedSubsheets[row.SubID] = row.SubName;
    });

    const getLabel = (key: string) => labels[key] || key;
    console.log("🌐 Loaded UILabelTranslations:", labels);
    const formatDate = (date: Date | string) =>
      new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    console.log("🌐 Translated Subsheet Names:", translatedSubsheets);
    console.log("🌐 Template Label Translations:", templateMap);

    const logoPath = path.resolve("public/clients", datasheet.ClientLogo);
    let logoBase64 = "";
    if (fs.existsSync(logoPath)) {
      const imageBuffer = fs.readFileSync(logoPath);
      const mimeType = `image/${path.extname(logoPath).slice(1)}`;
      logoBase64 = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
    }

    let htmlContent = `
    <html><head><style>
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 20px; color: #333; }
      h1, h2, h3 { margin-bottom: 8px; color: #2c3e50; }
      .table-wrapper { margin-bottom: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05); overflow: hidden; }
      table { width: 100%; border-collapse: separate; border-spacing: 0; background-color: #fff; border-radius: 8px; }
      th { background: linear-gradient(to bottom, #004080, #003060); color: white; padding: 8px 10px; font-weight: bold; border: 1px solid #ccc; text-align: left; font-size: 11px; }
      td { padding: 8px 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-size: 10px; }
      tr:nth-child(even) td { background-color: #eef3f8; }
      tr:hover td { background-color: #d9e8ff; }
      .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #1a3c66; }
      img { object-fit: contain; }
    </style></head><body>

    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
      <img src="${logoBase64}" alt="${datasheet.ClientName}" style="width: 64px; height: 64px; border-radius: 8px;" />
      <div>
        <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${getLabel("SheetNameEng")}</h1>
        <h2 style="font-size: 16px; color: #555; margin: 4px 0 0 0;">${getLabel("SheetDescEng")}</h2>
      </div>
    </div>

    <div class="table-wrapper">
      <h3 class="section-title">${getLabel("SheetDetails")}</h3>
      <table><tbody>
        <tr><td>${getLabel("ClientDocNum")}</td><td>${datasheet.ClientDocNum}</td><td>${getLabel("CompanyDocNum")}</td><td>${datasheet.CompanyDocNum}</td></tr>
        <tr><td>${getLabel("ClientProjNum")}</td><td>${datasheet.ClientProjNum}</td><td>${getLabel("CompanyProjNum")}</td><td>${datasheet.CompanyProjNum}</td></tr>
        <tr><td>${getLabel("AreaID")}</td><td>${datasheet.AreaName}</td><td>${getLabel("PackageName")}</td><td>${datasheet.PackageName}</td></tr>
        <tr><td>${getLabel("RevisionNum")}</td><td>${datasheet.RevisionNum}</td><td>${getLabel("VerifiedByID")}</td><td>${datasheet.VerifiedBy}</td></tr>
        <tr><td>${getLabel("RevisionDate")}</td><td>${formatDate(datasheet.RevisionDate)}</td><td>${getLabel("VerifiedByDate")}</td><td>${formatDate(datasheet.VerifiedByDate)}</td></tr>
        <tr><td>${getLabel("PreparedByID")}</td><td>${datasheet.PreparedBy}</td><td>${getLabel("ApprovedByID")}</td><td>${datasheet.ApprovedBy}</td></tr>
        <tr><td>${getLabel("PreparedByDate")}</td><td>${formatDate(datasheet.PreparedByDate)}</td><td>${getLabel("ApprovedByDate")}</td><td>${formatDate(datasheet.ApprovedByDate)}</td></tr>
      </tbody></table>
    </div>

    <div class="table-wrapper">
      <h3 class="section-title">${getLabel("EquipmentDetails")}</h3>
      <table><tbody>
        <tr><td>${getLabel("EquipmentName")}</td><td>${datasheet.EquipmentName}</td><td>${getLabel("EquipmentTagNum")}</td><td>${datasheet.EquipmentTagNum}</td></tr>
        <tr><td>${getLabel("ClientName")}</td><td>${datasheet.ClientName}</td><td>${getLabel("EquipSize")}</td><td>${datasheet.EquipSize}</td></tr>
        <tr><td>${getLabel("ServiceName")}</td><td>${datasheet.ServiceName}</td><td>${getLabel("ModelNumber")}</td><td>${datasheet.ModelNumber}</td></tr>
        <tr><td>${getLabel("RequiredQty")}</td><td>${datasheet.RequiredQty}</td><td>${getLabel("Driver")}</td><td>${datasheet.Driver}</td></tr>
        <tr><td>${getLabel("ItemLocation")}</td><td>${datasheet.ItemLocation}</td><td>${getLabel("PID")}</td><td>${datasheet.PID}</td></tr>
        <tr><td>${getLabel("ManuID")}</td><td>${datasheet.ManuName}</td><td>${getLabel("LocationDwg")}</td><td>${datasheet.LocationDwg}</td></tr>
        <tr><td>${getLabel("SuppID")}</td><td>${datasheet.SuppName}</td><td>${getLabel("InstallDwg")}</td><td>${datasheet.InstallDwg}</td></tr>
        <tr><td>${getLabel("InstallPackNum")}</td><td>${datasheet.InstallPackNum}</td><td>${getLabel("CodeStd")}</td><td>${datasheet.CodeStd}</td></tr>
      </tbody></table>
    </div>
    `;

    for (const subsheet of subsheets) {
      const infoList = await getInformationBySubSheetId(Number(subsheet.SubID), Number(sheetId)) as SubsheetInfo[];
      const translatedSubName = translatedSubsheets[subsheet.SubID] ?? subsheet.SubNameEng;

      htmlContent += `
        <div class="table-wrapper">
          <h3 class="section-title">${translatedSubName}</h3>
          <table>
            <thead>
              <tr>
                <th>${getLabel("TemplateInfo")}</th>
                <th>${getLabel("TemplateValue")}</th>
                <th>${getLabel("TemplateUOM")}</th>
              </tr>
            </thead>
            <tbody>
              ${infoList.map((info) => {
                const { value, unit } = uom === "SI"
                  ? { value: info.InfoValue, unit: info.UOM }
                  : convertToUSC(info.InfoValue, info.UOM);
                const label = templateMap[String(info.InfoTemplateID)] || info.LabelEng;

                console.log("📄 Row label:", {
                  id: info.InfoTemplateID,
                  usedLabel: templateMap[info.InfoTemplateID],
                  fallback: info.LabelEng
                });

                return `
                  <tr>
                    <td>${label}</td>
                    <td>${value}</td>
                    <td>${unit}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    htmlContent += "</body></html>";

    const debugDir = path.resolve(process.cwd(), "public", "debug");
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    fs.writeFileSync(path.join(debugDir, "debug-datasheet.html"), htmlContent);
    console.log("✅ HTML saved to public/debug/debug-datasheet.html");

    return await pdf.generatePdf({ content: htmlContent }, { format: "A4" });

  } catch (err) {
    console.error("❌ Error generating PDF:", err);
    throw err;
  }
}


export async function generateDatasheetExcel(sheetId: string, uom: "SI" | "USC", languageCode: string): Promise<Buffer> {
  const datasheet = await getDatasheetById(sheetId);
  if (!datasheet) throw new Error("Datasheet not found");

  const labelMap = await getUILabelTranslations(languageCode);
  const subsheets = await getSubSheetsBySheetId(Number(sheetId));
  const translatedSubsheets = await getTranslatedSubSheets(Number(sheetId), languageCode);
  const translatedSubsheetMap: Record<number, string> = {};
  translatedSubsheets.forEach(row => {
    translatedSubsheetMap[row.SubID] = row.SubName;
  });
  const templateMap = await getTranslatedTemplateLabels(Number(sheetId), languageCode);

  const allInfo: Record<number, SubsheetInfo[]> = {};
  for (const sub of subsheets) {
    allInfo[sub.SubID] = await getInformationBySubSheetId(sub.SubID, Number(sheetId)) as SubsheetInfo[];
  }

  const getLabel = (key: string): string => labelMap[key] || key;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Datasheet");
  worksheet.columns = new Array(8).fill(null).map(() => ({ width: 20 }));
  worksheet.getRow(1).height = 70;
  worksheet.getRow(2).height = 25;
  worksheet.mergeCells("B1:B2");
  worksheet.mergeCells("C1:H2");

  worksheet.getCell("C1").value = {
    richText: [
      { text: `${getLabel("SheetNameEng")}\n`, font: { bold: true, size: 16 } },
      { text: `${getLabel("SheetDescEng")}`, font: { size: 11 } }
    ]
  };
  worksheet.getCell("C1").alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  const logoPath = path.resolve("public/clients", datasheet.ClientLogo);
  if (fs.existsSync(logoPath)) {
    const imageId = workbook.addImage({
      filename: logoPath,
      extension: path.extname(logoPath).slice(1),
    });
    worksheet.addImage(imageId, {
      tl: { col: 1, row: 0 },
      ext: { width: 80, height: 80 },
    });
  }

  let rowIdx = 4;
  const details = [
    [getLabel("ClientDocNum"), datasheet.ClientDocNum, getLabel("CompanyDocNum"), datasheet.CompanyDocNum],
    [getLabel("ClientProjNum"), datasheet.ClientProjNum, getLabel("CompanyProjNum"), datasheet.CompanyProjNum],
    [getLabel("AreaID"), datasheet.AreaName, getLabel("PackageName"), datasheet.PackageName],
    [getLabel("RevisionNum"), datasheet.RevisionNum, getLabel("VerifiedByID"), datasheet.VerifiedBy],
    [getLabel("RevisionDate"), datasheet.RevisionDate, getLabel("VerifiedByDate"), datasheet.VerifiedByDate],
    [getLabel("PreparedByID"), datasheet.PreparedBy, getLabel("ApprovedByID"), datasheet.ApprovedBy],
    [getLabel("PreparedByDate"), datasheet.PreparedByDate, getLabel("ApprovedByDate"), datasheet.ApprovedByDate],
  ];

  // ✅ Header for Datasheet Details
  worksheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  const hdr = worksheet.getCell(`A${rowIdx}`);
  hdr.value = getLabel("SheetDetails");
  hdr.font = { bold: true, size: 14 };
  hdr.alignment = { horizontal: "center", vertical: "middle" };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DDEBF7" } };
  worksheet.getRow(rowIdx).height = 25;
  rowIdx++;

  for (const [l1, v1, l2, v2] of details) {
    const bg = rowIdx % 2 === 0 ? "FFFFFF" : "E9F1FB";
    worksheet.mergeCells(`B${rowIdx}:D${rowIdx}`);
    worksheet.mergeCells(`F${rowIdx}:H${rowIdx}`);
    worksheet.getCell(`A${rowIdx}`).value = l1;
    worksheet.getCell(`E${rowIdx}`).value = l2;
    worksheet.getCell(`B${rowIdx}`).value = v1;
    worksheet.getCell(`F${rowIdx}`).value = v2;
    worksheet.getRow(rowIdx).eachCell((cell) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    });
    rowIdx++;
  }

  rowIdx++;

  const equipmentDetails = [
    [getLabel("EquipmentName"), datasheet.EquipmentName, getLabel("EquipmentTagNum"), datasheet.EquipmentTagNum],
    [getLabel("ClientID"), datasheet.ClientName, getLabel("EquipSize"), datasheet.EquipSize],
    [getLabel("ServiceName"), datasheet.ServiceName, getLabel("ModelNumber"), datasheet.ModelNumber],
    [getLabel("RequiredQty"), datasheet.RequiredQty, getLabel("Driver"), datasheet.Driver],
    [getLabel("ItemLocation"), datasheet.ItemLocation, getLabel("PID"), datasheet.PID],
    [getLabel("ManuID"), datasheet.ManuName, getLabel("LocationDwg"), datasheet.LocationDwg],
    [getLabel("SuppID"), datasheet.SuppName, getLabel("InstallDwg"), datasheet.InstallDwg],
    [getLabel("InstallPackNum"), datasheet.InstallPackNum, getLabel("CodeStd"), datasheet.CodeStd],
  ];

  worksheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  const equipHdr = worksheet.getCell(`A${rowIdx}`);
  equipHdr.value = getLabel("EquipmentDetails");
  equipHdr.font = { bold: true, size: 14 };
  equipHdr.alignment = { horizontal: "center", vertical: "middle" };
  equipHdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DDEBF7" } };
  worksheet.getRow(rowIdx).height = 25;
  rowIdx++;

  for (const [l1, v1, l2, v2] of equipmentDetails) {
    const bg = rowIdx % 2 === 0 ? "FFFFFF" : "E9F1FB";
    worksheet.mergeCells(`B${rowIdx}:D${rowIdx}`);
    worksheet.mergeCells(`F${rowIdx}:H${rowIdx}`);
    worksheet.getCell(`A${rowIdx}`).value = l1;
    worksheet.getCell(`E${rowIdx}`).value = l2;
    worksheet.getCell(`B${rowIdx}`).value = v1;
    worksheet.getCell(`F${rowIdx}`).value = v2;
    worksheet.getRow(rowIdx).eachCell((cell) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    });
    rowIdx++;
  }

  for (const subsheet of subsheets) {
    rowIdx++;
    const subName = translatedSubsheetMap[subsheet.SubID] ?? subsheet.SubNameEng;
    worksheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
    worksheet.getCell(`A${rowIdx}`).value = subName;
    worksheet.getCell(`A${rowIdx}`).font = { bold: true, size: 14 };
    worksheet.getCell(`A${rowIdx}`).alignment = { horizontal: "center" };
    worksheet.getCell(`A${rowIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DDEBF7" } };
    rowIdx++;

    worksheet.mergeCells(`A${rowIdx}:D${rowIdx}`);
    worksheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
    worksheet.mergeCells(`G${rowIdx}:H${rowIdx}`);
    worksheet.getCell(`A${rowIdx}`).value = getLabel("TemplateInfo");
    worksheet.getCell(`E${rowIdx}`).value = getLabel("TemplateValue");
    worksheet.getCell(`G${rowIdx}`).value = getLabel("TemplateUOM");
    worksheet.getCell(`A${rowIdx}`).font = { bold: true };
    worksheet.getCell(`E${rowIdx}`).font = { bold: true };
    worksheet.getCell(`G${rowIdx}`).font = { bold: true };
    rowIdx++;

    const infoList = allInfo[subsheet.SubID] || [];
    for (const info of infoList) {
      const converted = uom === "SI" ? { value: info.InfoValue, unit: info.UOM } : convertToUSC(info.InfoValue, info.UOM);
      const bg = rowIdx % 2 === 0 ? "FFFFFF" : "F5F9FC";

      worksheet.mergeCells(`A${rowIdx}:D${rowIdx}`);
      worksheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
      worksheet.mergeCells(`G${rowIdx}:H${rowIdx}`);
      const labelKey = info.InfoTemplateID ? String(info.InfoTemplateID) : null;
      const label = labelKey && templateMap[labelKey] ? templateMap[labelKey] : info.LabelEng;
      worksheet.getCell(`A${rowIdx}`).value = label;
      worksheet.getCell(`E${rowIdx}`).value = converted.value;
      worksheet.getCell(`G${rowIdx}`).value = converted.unit;

      worksheet.getRow(rowIdx).eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      });
      rowIdx++;
    }
  }

  return await workbook.xlsx.writeBuffer();
}

