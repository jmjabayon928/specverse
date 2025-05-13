// src/types/sheet.ts

export interface Sheet {
  sheetId: number;
  sheetName: string;
  sheetDesc?: string;
  categoryId?: number;
  categoryName?: string;
  preparedBy?: number;
  preparedByName?: string;
  revisionDate?: string;
}
