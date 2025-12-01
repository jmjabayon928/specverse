// src/types/translation.ts

export interface SheetTranslations {
  sheet?: {
    sheetName?: string;
    sheetDesc?: string;
    sheetDesc2?: string;
    equipmentName?: string;
    serviceName?: string;
  };
  subsheets?: Record<string, string>;
  labels?: Record<string, string>;
  options: Record<string, string[]>;
}