// src/types/extendedTemplate.ts

import type { FullTemplateInput } from "@/validation/sheetSchema";

export type ExtendedFullTemplateInput = FullTemplateInput & {
  status?: string;
  isTemplate?: boolean;
  isLatest?: boolean;
  autoCADImport?: boolean;
  sourceFilePath?: string;
  templateId?: number;
  parentSheetId?: number;
  verificationComment?: string;
  approvalComment?: string;
  modifiedBy?: number;
  modifiedAt?: string;
  verificationRejectedById?: number;
  verificationRejectedDate?: string;
  approvalRejectedById?: number;
  approvalRejectedDate?: string;
};
