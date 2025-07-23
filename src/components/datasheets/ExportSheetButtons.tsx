"use client";

import React from "react";
import { handleExport } from "@/utils/datasheetExport";
import Button from "@/components/ui/button/Button";

type ExportSheetButtonsProps = {
  sheetId: number;
  sheetName: string;
  revisionNum: number;
  unitSystem: "SI" | "USC";
  language: string;
  isTemplate: boolean;
  clientName: string;
};

const ExportSheetButtons: React.FC<ExportSheetButtonsProps> = ({
  sheetId,
  sheetName,
  revisionNum,
  unitSystem,
  language,
  isTemplate,
  clientName,
}) => {
  const exportSheet = async (type: "pdf" | "excel") => {
    await handleExport({
      sheetId,
      type,
      unitSystem,
      language,
      sheetName,
      revisionNum,
      isTemplate,
      clientName,
    });
  };

  return (
    <div className="flex gap-2 mt-4">
      <Button variant="outline" onClick={() => exportSheet("pdf")}>
        Export as PDF
      </Button>
      <Button variant="outline" onClick={() => exportSheet("excel")}>
        Export as Excel
      </Button>
    </div>
  );
};

export default ExportSheetButtons;
