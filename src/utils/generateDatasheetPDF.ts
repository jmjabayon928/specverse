// src/utils/generateDatasheetPDF.ts
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { convertToUSC } from "@/utils/unitConversionTable";
import { getLabel } from "@/utils/translationUtils";
import { translations } from "@/constants/translations";
import type { UnifiedSheet, UnifiedSubsheet } from "@/types/sheet";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import type { AttachmentDTO } from "@/types/attachments";
import { Buffer } from "buffer";

/** Optional extras you can pass when generating the PDF */
type GeneratePDFOptions = {
  notes?: SheetNoteDTO[];                 // pre-fetched notes (recommended)
  attachments?: AttachmentDTO[];          // pre-fetched attachments (recommended)
  /** If true, will try to fetch attachment images by URL and embed as <img> */
  allowNetworkFetch?: boolean;
  /** Optional cookie header to access protected /view endpoints, e.g. "session=abc; Path=/; ..." */
  authCookie?: string;
};

export interface DatasheetPDFResult {
  buffer: Buffer;
  fileName: string;
}

type LangCode = keyof typeof translations["sheetName"];

export async function generateDatasheetPDF(
  sheet: UnifiedSheet,
  lang: string,
  uom: "SI" | "USC",
  options?: GeneratePDFOptions
): Promise<DatasheetPDFResult> {
  const clean = (s: string | number | null | undefined) =>
    String(s ?? "")
      .replace(/[\/\\?%*:|"<>]/g, "")
      .trim()
      .replace(/\s+/g, "_");

  const sheetType = sheet.isTemplate ? "Template" : "FilledSheet";
  const fileName = `${clean(sheetType)}-${clean(sheet.clientName)}-${clean(
    sheet.sheetName
  )}-RevNo-${clean(sheet.revisionNum)}-${uom}-${lang}.pdf`;

  const langCode = lang as LangCode;

  const uiMap: Record<string, string> = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [key, value[langCode] ?? key])
  );
  const getUI = (key: string) => getLabel(key, uiMap);

  const isUSC = uom === "USC";

  // Handle client logo
  const logoFileName = sheet.clientLogo ?? "";
  const logoPath = path.resolve(`public/clients/${logoFileName}`);
  const logoExt = path.extname(logoFileName).replace(".", "") || "png";

  let logoBase64 = "";
  if (logoFileName && fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  }

  const translatedStatus =
    translations[sheet.status as keyof typeof translations]?.[langCode] ??
    sheet.status ??
    "Draft";

  const buildSubsheetTable = (subsheet: UnifiedSubsheet) => {
    const rows = subsheet.fields
      .map((field) => {
        const label = field.label;
        const requiredStar = field.required ? " <span style='color:red'>*</span>" : "";
        const options = field.options?.join(", ") || "";

        let uomLabel = field.uom || "";
        let value = field.value ?? "";

        if (isUSC && field.uom) {
          if (field.value != null && field.value !== "") {
            const converted = convertToUSC(String(field.value), field.uom);
            value = converted?.value ?? field.value;
            uomLabel = converted?.unit ?? field.uom;
          } else {
            const converted = convertToUSC("0", field.uom); // dummy value to extract USC unit
            uomLabel = converted?.unit ?? field.uom;
            value = "";
          }
        }

        return `
          <tr class="table-body">
            <td>${label}${requiredStar}</td>
            <td>${uomLabel}</td>
            <td>${options}</td>
            <td>${value}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="section-title">${subsheet.name}</div>
      <table style="width:100%; border-collapse: collapse;" border="1">
        <thead class="table-header">
          <tr style="background-color:#f2f2f2;">
            <th>${getUI("InfoLabel")}</th>
            <th>${getUI("InfoUOM")}</th>
            <th>${getUI("InfoOptions")}</th>
            <th>${getUI("InfoValue")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  };

  // -------- NEW: Notes Section helpers --------
  const notes = options?.notes ?? [];
  const notesByType = groupNotes(notes);
  const notesHtml =
    notes.length === 0
      ? ""
      : `
      <h2 class="section-title">Notes</h2>
      ${notesByType
        .map(
          (g) => `
        <div style="margin-bottom:10px;">
          <div style="font-weight:bold; font-size:11px; margin:6px 0;">${escapeHtml(
            g.typeLabel
          )}</div>
          <ol style="margin:0; padding-left:18px; font-size:10px;">
            ${g.items
              .map(
                (n) =>
                  `<li style="margin:2px 0; line-height:1.35;">${escapeHtml(n.NoteText)}</li>`
              )
              .join("")}
          </ol>
        </div>
      `
        )
        .join("")}
    `;

  // -------- NEW: Attachments Section helpers --------
  const atts = options?.attachments ?? [];
  const groupedAtts = groupAttachments(atts);

  // If allowed, try to fetch image bytes and embed as data-url (gracefully falls back if it fails)
  async function embedImageIfAllowed(a: AttachmentDTO): Promise<string | null> {
    if (!options?.allowNetworkFetch) return null;
    if (!a.Url || !a.MimeType?.startsWith("image/")) return null;
    try {
      const res = await fetch(a.Url, {
        headers: options?.authCookie ? { Cookie: options.authCookie } : undefined,
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const b64 = Buffer.from(ab).toString("base64");
      return `data:${a.MimeType};base64,${b64}`;
    } catch {
      return null;
    }
  }

  async function buildAttachmentsHtml(): Promise<string> {
    if (atts.length === 0) return "";

    // IMAGES
    let imagesBlock = "";
    if (groupedAtts.images.length > 0) {
      const itemsHtml = await Promise.all(
        groupedAtts.images.map(async (a) => {
          const dataUrl = await embedImageIfAllowed(a);
          const imgTag = dataUrl
            ? `<img src="${dataUrl}" alt="${escapeHtml(
                a.FileName
              )}" style="max-width:160px; max-height:120px; object-fit:contain; border:1px solid #e5e7eb; padding:4px; background:#fff;" />`
            : `<div style="font-size:10px; color:#6b7280; border:1px dashed #d1d5db; padding:8px; text-align:center;">(image preview disabled)</div>`;
          const link = a.Url
            ? `<div><a href="${a.Url}" style="font-size:9px; color:#2563eb; text-decoration:none;">${escapeHtml(
                a.FileName
              )}</a></div>`
            : `<div style="font-size:9px;">${escapeHtml(a.FileName)}</div>`;
          return `
            <div style="display:inline-block; margin:6px; text-align:center;">
              ${imgTag}
              ${link}
            </div>
          `;
        })
      );

      imagesBlock = `
        <div style="margin-top:8px;">
          <div style="font-weight:bold; font-size:11px; margin:6px 0;">Images (${groupedAtts.images.length})</div>
          <div>${itemsHtml.join("")}</div>
        </div>
      `;
    }

    // PDFs
    const pdfsBlock =
      groupedAtts.pdfs.length > 0
        ? `
      <div style="margin-top:8px;">
        <div style="font-weight:bold; font-size:11px; margin:6px 0;">PDFs (${groupedAtts.pdfs.length})</div>
        <ul style="margin:0; padding-left:16px; font-size:10px;">
          ${groupedAtts.pdfs
            .map((a) => {
              const label = escapeHtml(a.FileName);
              return a.Url
                ? `<li style="margin:2px 0;"><a href="${a.Url}" style="color:#2563eb; text-decoration:none;">${label}</a></li>`
                : `<li style="margin:2px 0;">${label}</li>`;
            })
            .join("")}
        </ul>
      </div>
    `
        : "";

    // OTHERS
    const othersBlock =
      groupedAtts.others.length > 0
        ? `
      <div style="margin-top:8px;">
        <div style="font-weight:bold; font-size:11px; margin:6px 0;">Other Files (${groupedAtts.others.length})</div>
        <ul style="margin:0; padding-left:16px; font-size:10px;">
          ${groupedAtts.others
            .map((a) => {
              const label = escapeHtml(a.FileName);
              return a.Url
                ? `<li style="margin:2px 0;"><a href="${a.Url}" style="color:#2563eb; text-decoration:none;">${label}</a></li>`
                : `<li style="margin:2px 0;">${label}</li>`;
            })
            .join("")}
        </ul>
      </div>
    `
        : "";

    return `
      <h2 class="section-title">Attachments</h2>
      ${imagesBlock}
      ${pdfsBlock}
      ${othersBlock}
    `;
  }

  const attachmentsHtml = await buildAttachmentsHtml();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2, h3 { margin: 0; padding: 0; color: #333; }
        table { margin-bottom: 30px; }
        th, td { padding: 8px; text-align: left; }
        .header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 30px; }
        .logo { width: 96px; height: 96px; object-fit: contain; }
        .sheet-meta h1 { font-size: 12px; font-weight: bold; color: #1f2937; }
        .sheet-meta h2 { font-size: 11px; font-weight: bold; color: #374151; margin-top: 4px; }
        .sheet-meta h3 { font-size: 10px; font-weight: normal; color: #4b5563; margin-top: 4px; }
        .section-title { font-size: 12px; font-weight: bold; margin-top: 20px; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
        .data-row td.label { font-size: 10px; font-weight: normal; width: 25%; }
        .data-row td.value { font-size: 10px; font-weight: bold; width: 25%; }
        .table-header th { font-size: 11px; font-weight: bold; }
        .table-body td { font-size: 10px; font-weight: normal; }
      </style>
    </head>
    <body>
      <div class="header">
        ${
          logoBase64
            ? `<img src="data:image/${logoExt};base64,${logoBase64}" class="logo" alt="Client Logo" />`
            : "<!-- Logo not found -->"
        }
        <div class="sheet-meta">
          <h1>${translatedStatus} – ${sheet.sheetName}</h1>
          <h2>${sheet.sheetDesc ?? ""}</h2>
          <h3>${sheet.sheetDesc2 ?? ""}</h3>
        </div>
      </div>

      <h2 class="section-title">${getUI("Datasheet Details")}</h2>
      <table class="data-table" style="width:100%; border-collapse: collapse;" border="1">
        <tr class="data-row">
          <td class="label">${getUI("sheetName")}</td><td class="value">${sheet.sheetName}</td>
          <td class="label">${getUI("sheetDesc")}</td><td class="value">${sheet.sheetDesc ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("sheetDesc2")}</td><td class="value">${sheet.sheetDesc2 ?? "-"}</td>
          <td class="label">${getUI("clientDocNum")}</td><td class="value">${sheet.clientDocNum ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("clientProjectNum")}</td><td class="value">${sheet.clientProjectNum ?? "-"}</td>
          <td class="label">${getUI("companyDocNum")}</td><td class="value">${sheet.companyDocNum ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("companyProjectNum ")}</td><td class="value">${sheet.companyProjectNum ?? "-"}</td>
          <td class="label">${getUI("areaName")}</td><td class="value">${sheet.areaName ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("packageName")}</td><td class="value">${sheet.packageName ?? "-"}</td>
          <td class="label">${getUI("revisionNum")}</td><td class="value">${sheet.revisionNum ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("revisionDate")}</td><td class="value">${sheet.revisionDate ?? "-"}</td>
          <td class="label">${getUI("preparedByName")}</td><td class="value">${sheet.preparedByName ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("preparedByDate")}</td><td class="value">${sheet.preparedByDate ?? "-"}</td>
          <td class="label">${getUI("modifiedByName")}</td><td class="value">${sheet.modifiedByName || "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("modifiedByDate")}</td><td class="value">${sheet.modifiedByDate || "-"}</td>
          <td class="label">${getUI("rejectedByName")}</td><td class="value">${sheet.rejectedByName || "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("rejectedByDate")}</td><td class="value">${sheet.rejectedByDate || "-"}</td>
          <td class="label">${getUI("rejectComment")}</td><td class="value">${sheet.rejectComment || "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("verifiedByName")}</td><td class="value">${sheet.verifiedByName ?? "-"}</td>
          <td class="label">${getUI("verifiedByDate")}</td><td class="value">${sheet.verifiedDate ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("approvedByName")}</td><td class="value">${sheet.approvedByName ?? "-"}</td>
          <td class="label">${getUI("approvedByDate")}</td><td class="value">${sheet.approvedDate ?? "-"}</td>
        </tr>
      </table>

      <h2 class="section-title">${getUI("Equipment Details")}</h2>
      <table class="data-table" style="width:100%; border-collapse: collapse;" border="1">
        <tr class="data-row">
          <td class="label">${getUI("equipmentName")}</td><td class="value">${sheet.equipmentName}</td>
          <td class="label">${getUI("equipmentTagNum")}</td><td class="value">${sheet.equipmentTagNum}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("serviceName")}</td><td class="value">${sheet.serviceName}</td>
          <td class="label">${getUI("requiredQty")}</td><td class="value">${sheet.requiredQty}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("itemLocation")}</td><td class="value">${sheet.itemLocation}</td>
          <td class="label">${getUI("manuName")}</td><td class="value">${sheet.manuName}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("suppName")}</td><td class="value">${sheet.suppName}</td>
          <td class="label">${getUI("installPackNum")}</td><td class="value">${sheet.installPackNum ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("equipSize")}</td><td class="value">${sheet.equipSize}</td>
          <td class="label">${getUI("modelNum")}</td><td class="value">${sheet.modelNum ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("driver")}</td><td class="value">${sheet.driver ?? "-"}</td>
          <td class="label">${getUI("pid")}</td><td class="value">${sheet.pid ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("installDWG")}</td><td class="value">${sheet.installDwg ?? "-"}</td>
          <td class="label">${getUI("codeStandard")}</td><td class="value">${sheet.codeStd ?? "-"}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("categoryName")}</td><td class="value">${sheet.categoryName}</td>
          <td class="label">${getUI("clientName")}</td><td class="value">${sheet.clientName}</td>
        </tr>
        <tr class="data-row">
          <td class="label">${getUI("projectName")}</td><td class="value">${sheet.projectName}</td>
          <td class="label"></td>
        </tr>
      </table>

      ${sheet.subsheets.map(buildSubsheetTable).join("")}

      ${notesHtml}

      ${attachmentsHtml}

      <div style="font-size:9px; text-align:center; color:#6b7280; margin-top:40px; border-top:1px solid #ccc; padding-top:10px;">
        Generated by <strong>SpecVerse</strong> | © Jeff Martin Abayon, 2025 |
        <a href="https://github.com/jmjabayon928/specverse" target="_blank" style="color:#2563eb;">www.github.com/jmjabayon928/specverse</a>
      </div>

    </body>
    </html>
  `;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer: Uint8Array = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "7mm", right: "7mm" },
  });

  await browser.close();

  return {
    buffer: Buffer.from(pdfBuffer),
    fileName,
  };
}

/* ---------------- helpers ---------------- */

function groupNotes(notes: SheetNoteDTO[]): Array<{ typeLabel: string; items: SheetNoteDTO[] }> {
  if (!notes?.length) return [];
  const by: Record<string, SheetNoteDTO[]> = {};
  for (const n of notes) {
    const key = n.NoteType ?? String(n.NoteTypeID);
    (by[key] ||= []).push(n);
  }
  return Object.entries(by)
    .map(([typeLabel, items]) => {
      items.sort((a, b) => a.OrderIndex - b.OrderIndex || a.NoteID - b.NoteID);
      return { typeLabel, items };
    })
    .sort((a, b) => a.typeLabel.localeCompare(b.typeLabel));
}

function groupAttachments(atts: AttachmentDTO[]) {
  const images: AttachmentDTO[] = [];
  const pdfs: AttachmentDTO[] = [];
  const others: AttachmentDTO[] = [];
  for (const a of atts ?? []) {
    const mt = (a.MimeType || "").toLowerCase();
    if (mt.startsWith("image/")) images.push(a);
    else if (mt.includes("/pdf")) pdfs.push(a);
    else others.push(a);
  }
  return { images, pdfs, others };
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
