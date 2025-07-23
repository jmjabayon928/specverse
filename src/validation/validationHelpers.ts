// src/validation/validationHelpers.ts

import type { DatasheetInput, EquipmentInput } from './sheetSchema';

/**
 * Format flattened Zod fieldErrors into a readable alert string.
 * Each line shows the field path and error message(s).
 */
export function formatZodError(fieldErrors: Record<string, string[] | undefined>): string {
  const messages: string[] = [];

  for (const key in fieldErrors) {
    const errs = fieldErrors[key];
    if (errs && Array.isArray(errs)) {
      for (const msg of errs) {
        messages.push(`• ${key}: ${msg}`);
      }
    }
  }

  return messages.join('\n');
}

export function validateForm(
  datasheet: DatasheetInput,
  equipment: EquipmentInput
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  // 🔹 Datasheet validations
  if (!datasheet.sheetName?.trim()) errors.sheetName = ['Sheet name is required.'];
  if (!datasheet.sheetDesc?.trim()) errors.sheetDesc = ['Sheet description is required.'];
  if (!datasheet.sheetDesc2?.trim()) errors.sheetDesc2 = ['Additional description is required.'];

  if (datasheet.clientDoc !== undefined && datasheet.clientDoc < 0)
    errors.clientDoc = ['Client Doc # must be a positive number.'];
  if (datasheet.clientProject !== undefined && datasheet.clientProject < 0)
    errors.clientProject = ['Client Project # must be a positive number.'];

  if (datasheet.companyDoc !== undefined && datasheet.companyDoc < 0)
    errors.companyDoc = ['Company Doc # must be a positive number.'];
  if (datasheet.companyProject !== undefined && datasheet.companyProject < 0)
    errors.companyProject = ['Company Project # must be a positive number.'];

  if (!datasheet.areaId) errors.areaId = ['Area is required.'];
  if (!datasheet.packageName?.trim()) errors.packageName = ['Package name is required.'];
  if (!datasheet.revisionNum || datasheet.revisionNum < 1)
    errors.revisionNum = ['Revision number must be at least 1.'];

  if (!datasheet.preparedBy) errors.preparedBy = ['Prepared By is required.'];
  if (!datasheet.preparedDate?.trim()) errors.preparedDate = ['Prepared Date is required.'];

  if (datasheet.verifiedBy && !datasheet.verifiedDate?.trim())
    errors.verifiedDate = ['Verified Date is required when Verified By is selected.'];
  if (datasheet.verifiedDate && !datasheet.verifiedBy)
    errors.verifiedBy = ['Verified By is required when Verified Date is selected.'];

  if (datasheet.approvedBy && !datasheet.approvedDate?.trim())
    errors.approvedDate = ['Approved Date is required when Approved By is selected.'];
  if (datasheet.approvedDate && !datasheet.approvedBy)
    errors.approvedBy = ['Approved By is required when Approved Date is selected.'];

  // 🔹 Equipment validations
  if (!equipment.equipmentName?.trim()) errors.equipmentName = ['Equipment name is required.'];
  if (!equipment.equipmentTagNum?.trim()) errors.equipmentTagNum = ['Equipment Tag # is required.'];
  if (!equipment.serviceName?.trim()) errors.serviceName = ['Service name is required.'];

  if (equipment.equipSize !== undefined && equipment.equipSize < 0)
    errors.equipSize = ['Equipment size must be positive.'];
  if (!equipment.requiredQty || equipment.requiredQty < 1)
    errors.requiredQty = ['Required quantity must be at least 1.'];

  if (!equipment.itemLocation?.trim()) errors.itemLocation = ['Item location is required.'];
  if (!equipment.manufacturerId) errors.manufacturerId = ['Manufacturer is required.'];
  if (!equipment.supplierId) errors.supplierId = ['Supplier is required.'];
  if (!equipment.installPackNum?.trim()) errors.installPackNum = ['Install Pack # is required.'];
  if (!equipment.modelNum?.trim()) errors.modelNum = ['Model # is required.'];
  if (!equipment.driver?.trim()) errors.driver = ['Driver is required.'];
  if (!equipment.locationDWG?.trim()) errors.locationDWG = ['Location DWG is required.'];
  if (!equipment.pid && equipment.pid !== 0) errors.pid = ['P&ID # is required.'];
  if (!equipment.installDWG?.trim()) errors.installDWG = ['Install DWG is required.'];
  if (!equipment.codeStd?.trim()) errors.codeStd = ['Code/Std is required.'];
  if (!equipment.categoryId) errors.categoryId = ['Category is required.'];
  if (!equipment.clientId) errors.clientId = ['Client is required.'];
  if (!equipment.projectId) errors.projectId = ['Project is required.'];

  return errors;
}
