import type { ReferenceData } from "@/components/inventory/InventoryForm";

type RawReferenceData = {
  categories: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  manufacturers: { id: number; name: string }[];
};

export function remapReferenceData(rawData: RawReferenceData): ReferenceData {
  return {
    categories: rawData.categories.map(c => ({
      categoryId: c.id,
      categoryNameEng: c.name,
    })),
    suppliers: rawData.suppliers.map(s => ({
      suppId: s.id,
      suppName: s.name,
    })),
    manufacturers: rawData.manufacturers.map(m => ({
      manuId: m.id,
      manuName: m.name,
    })),
  };
}
