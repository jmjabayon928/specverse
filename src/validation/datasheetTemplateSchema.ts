import { z } from "zod";

// 🔹 Info Template inside a Subsheet
const infoTemplateSchema = z
  .object({
    id: z.number(),
    name: z.string().min(1, "Label is required"),
    type: z.enum(["int", "decimal", "varchar"]),
    uom: z.string(),
    options: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (val) => val.type === "varchar" || val.uom.trim().length > 0,
    {
      path: ["uom"],
      message: "Unit of measure is required for numeric types",
    }
  );

// 🔹 Subsheet with duplicate label validation
const subsheetSchema = z
  .object({
    id: z.number(),
    name: z.string().min(1, "Subsheet name is required"),
    templates: z.array(infoTemplateSchema),
  })
  .refine(
    (subsheet) => {
      const seen = new Set<string>();
      for (const template of subsheet.templates) {
        const key = template.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    {
      path: ["templates"],
      message: "Template labels must be unique within a subsheet (case-insensitive)",
    }
  );

// 🔹 Equipment section
const equipmentSchema = z.object({
  requiredQty: z.coerce.number().int().min(1),
  itemLocation: z.string().min(1),
  manufacturerId: z.coerce.number().int().min(1),
  supplierId: z.coerce.number().int().min(1),
  installPackNum: z.string(),
  modelNum: z.string(),
  driver: z.string().optional(),
  locationDWG: z.string().optional(),
  pid: z.coerce.number().int().min(1),
  installDWG: z.string().optional(),
  codeStd: z.string().optional(),
  categoryId: z.coerce.number().int().min(1),
  clientId: z.coerce.number().int().min(1),
  projectId: z.coerce.number().int().min(1),
  equipmentName: z.string().min(1),
  equipmentTagNum: z.string().min(1, "Equipment Tag # is required"),
  serviceName: z.string().min(1),
  equipSize: z.number(),
});

// 🔹 Datasheet section
const datasheetSchema = z.object({
  sheetName: z.string().min(1, "Sheet name is required"),
  sheetDesc: z.string().min(1, "Description is required"),
  sheetDesc2: z.string().optional(),
  clientDoc: z.coerce.number().optional(),
  clientProject: z.coerce.number().optional(),
  companyDoc: z.coerce.number().optional(),
  companyProject: z.coerce.number().optional(),
  areaId: z.coerce.number().int().min(1),
  packageName: z.string().min(1),
  revisionNum: z.coerce.number().int().min(1),
  revisionDate: z.string().optional(),
  preparedBy: z.coerce.number().int().min(1),
  preparedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid prepared date",
  }),
  verifiedBy: z.coerce.number().optional(),
  verifiedDate: z.string().optional(),
  approvedBy: z.coerce.number().optional(),
  approvedDate: z.string().optional(),
});

// 🔹 Full schema
export const fullTemplateSchema = z.object({
  datasheet: datasheetSchema,
  equipment: equipmentSchema,
  subsheets: z.array(subsheetSchema).min(1),
});

// 🔹 Type aliases
export type FullTemplateInput = z.infer<typeof fullTemplateSchema>;
export type DatasheetInput = z.infer<typeof datasheetSchema>;
export type EquipmentInput = z.infer<typeof equipmentSchema>;
export type SubsheetInput = z.infer<typeof subsheetSchema>;
