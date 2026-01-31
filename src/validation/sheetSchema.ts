// src/validation/sheetSchema.ts

import { z } from "zod";

export const infoFieldSchema = z
  .object({
    id: z.number().optional(),
    label: z.string().min(1, "Field label is required"),
    infoType: z.enum(["int", "decimal", "varchar"]),
    uom: z.string().optional(),
    sortOrder: z.number(),
    required: z.boolean(),
    options: z.array(z.string()).optional(),
    value: z.union([z.string(), z.number(), z.null()]).optional(),
  })
  .superRefine((field, ctx) => {
    if (
      field.required &&
      (field.value === undefined || field.value === null || String(field.value).trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "This field is required.",
      });
    }
  });

/**
 * Template builder variant: validates field structure (label, infoType, required, options)
 * but does NOT require value when required=true. Used for template create/clone only.
 */
export const infoFieldTemplateSchema = z.object({
  id: z.number().optional(),
  label: z.string().min(1, "Field label is required"),
  infoType: z.enum(["int", "decimal", "varchar"]),
  uom: z.string().optional(),
  sortOrder: z.number(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

export const subsheetSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Subsheet name is required"),
  fields: z.array(infoFieldSchema).min(1, "At least 1 field is required"),
});

export const subsheetTemplateSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Subsheet name is required"),
  fields: z.array(infoFieldTemplateSchema).min(1, "At least 1 field is required"),
});

export const unifiedSheetSchema = z.object({
  sheetId: z.number().optional(),
  sheetName: z.string().min(1, "Sheet Name is required"),
  sheetDesc: z.string().min(1, "Description is required"),
  sheetDesc2: z.string().optional(),

  clientDocNum: z.number().gt(0, "Client Doc # is required"),
  clientProjectNum: z.number().gt(0, "Client Project # is required"),
  companyDocNum: z.number().gt(0, "Company Doc # is required"),
  companyProjectNum: z.number().gt(0, "Company Project # is required"),

  areaId: z.number().gt(0, "Area is required"),
  packageName: z.string().min(1, "Package Name is required"),
  revisionNum: z.number(),
  revisionDate: z.string(),
  preparedById: z.number(),
  preparedByDate: z.string(),

  status: z.enum(["Draft", "Rejected", "Modified Draft", "Verified", "Approved"]).optional(),
  verifiedById: z.number().nullable().optional(),
  verifiedDate: z.string().nullable().optional(),
  approvedById: z.number().nullable().optional(),
  approvedDate: z.string().nullable().optional(),
  approvalComment: z.string().optional(),
  isLatest: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  autoCADImport: z.boolean().optional(),

  itemLocation: z.string().min(1, "Item Location is required"),
  requiredQty: z.number().gt(0),
  equipmentName: z.string().min(1, "Equipment Name is required"),
  equipmentTagNum: z.string().min(1, "Equipment Tag Number is required"),
  serviceName: z.string().min(1, "Service Name is required"),
  manuId: z.number().gt(0, "Manufacturer is required"),
  suppId: z.number().gt(0, "Supplier is required"),
  installPackNum: z.string().optional(),
  equipSize: z.number(),
  modelNum: z.string().optional(),
  driver: z.string().optional(),
  locationDwg: z.string().optional(),
  pid: z.number().optional(),
  installDwg: z.string().optional(),
  codeStd: z.string().optional(),
  categoryId: z.number().gt(0, "Category is required"),
  clientId: z.number().gt(0, "Client is required"),
  projectId: z.number().gt(0, "Project is required"),

  disciplineId: z.number().positive("Discipline is required").optional(),
  subtypeId: z.number().positive().nullable().optional(),

  subsheets: z.array(subsheetSchema).min(1, "At least one subsheet is required"),
});

/**
 * Template create/clone variant: same as unifiedSheetSchema but subsheets use
 * subsheetTemplateSchema (no value required when required=true). Use for template
 * builder only; filled sheets keep using unifiedSheetSchema.
 */
export const unifiedTemplateSchema = unifiedSheetSchema.extend({
  subsheets: z.array(subsheetTemplateSchema).min(1, "At least one subsheet is required"),
});

export const fullTemplateSchema = unifiedSheetSchema;

/**
 * Metadata-only schema for template edit. Validates only top-level Sheets-level
 * fields (header metadata). Does NOT validate subsheets or InfoField.value.
 * Used by TemplateEditorForm so save is not blocked by read-only subsheet structure.
 */
export const templateEditMetadataSchema = z.object({
  sheetId: z.number().optional(),
  sheetName: z.string().min(1, "Sheet Name is required"),
  sheetDesc: z.string().min(1, "Description is required"),
  sheetDesc2: z.string().optional(),

  clientDocNum: z.number().gt(0, "Client Doc # is required"),
  clientProjectNum: z.number().gt(0, "Client Project # is required"),
  companyDocNum: z.number().gt(0, "Company Doc # is required"),
  companyProjectNum: z.number().gt(0, "Company Project # is required"),

  areaId: z.number().gt(0, "Area is required"),
  packageName: z.string().min(1, "Package Name is required"),
  revisionNum: z.number(),
  revisionDate: z.string(),
  preparedById: z.number(),
  preparedByDate: z.string(),

  status: z.enum(["Draft", "Rejected", "Modified Draft", "Verified", "Approved"]).optional(),
  verifiedById: z.number().nullable().optional(),
  verifiedDate: z.string().nullable().optional(),
  approvedById: z.number().nullable().optional(),
  approvedDate: z.string().nullable().optional(),
  approvalComment: z.string().optional(),
  isLatest: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  autoCADImport: z.boolean().optional(),

  itemLocation: z.string().min(1, "Item Location is required"),
  requiredQty: z.number().gt(0),
  equipmentName: z.string().min(1, "Equipment Name is required"),
  equipmentTagNum: z.string().min(1, "Equipment Tag Number is required"),
  serviceName: z.string().min(1, "Service Name is required"),
  manuId: z.number().gt(0, "Manufacturer is required"),
  suppId: z.number().gt(0, "Supplier is required"),
  installPackNum: z.string().optional(),
  equipSize: z.number(),
  modelNum: z.string().optional(),
  driver: z.string().optional(),
  locationDwg: z.string().optional(),
  pid: z.number().optional(),
  installDwg: z.string().optional(),
  codeStd: z.string().optional(),
  categoryId: z.number().gt(0, "Category is required"),
  clientId: z.number().gt(0, "Client is required"),
  projectId: z.number().gt(0, "Project is required"),

  disciplineId: z.number().positive("Discipline is required").optional(),
  subtypeId: z.number().positive().nullable().optional(),
});
