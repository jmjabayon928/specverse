"use client";

import React from "react";
import Image from "next/image";
import IconTooltip from "@/components/common/IconTooltip";
import { handleExport } from "@/utils/datasheetExport";

type ExportSheetButtonsProps = {
  sheetId: number;
  sheetName: string;
  revisionNum: number;
  clientName: string;
  unitSystem: "SI" | "USC";
  language: string;
  isTemplate: boolean;
  isDetailPage?: boolean; // optional fallback if iconSize is not provided
  iconSize?: number;       // new optional prop to sync icon sizes
};

const ExportSheetButtons: React.FC<ExportSheetButtonsProps> = ({
  sheetId,
  sheetName,
  revisionNum,
  clientName,
  unitSystem,
  language,
  isTemplate,
  isDetailPage = false,
  iconSize,
}) => {
  // ✅ Use passed iconSize or fallback to isDetailPage logic
  const computedSize = iconSize ?? (isDetailPage ? 32 : 20);
  const sizeClass = computedSize >= 32 ? "w-8 h-8" : "w-5 h-5";

  const onExport = (type: "pdf" | "excel") => {
    handleExport({
      sheetId,
      type,
      unitSystem,
      language,
      sheetName,
      revisionNum,
      clientName,
      isTemplate,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <IconTooltip label="Export as PDF">
        <button
          onClick={() => onExport("pdf")}
          title="Export as PDF"
          className="hover:opacity-80 transition"
        >
          <Image
            src="/images/pdf.png"
            alt="PDF Icon"
            width={computedSize}
            height={computedSize}
            className={sizeClass}
          />
        </button>
      </IconTooltip>

      <IconTooltip label="Export as Excel">
        <button
          onClick={() => onExport("excel")}
          title="Export as Excel"
          className="hover:opacity-80 transition"
        >
          <Image
            src="/images/xls.png"
            alt="Excel Icon"
            width={computedSize}
            height={computedSize}
            className={sizeClass}
          />
        </button>
      </IconTooltip>
    </div>
  );
};

export default ExportSheetButtons;
