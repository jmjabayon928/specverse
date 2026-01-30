// Normalize category-contribution API response so category.items is always an array.
// Prevents "items is not iterable" when backend returns null/missing/non-array.

export interface ItemDetail {
  itemName: string;
  quantity: number;
}

export interface CategoryContribution {
  categoryName: string;
  items: ItemDetail[];
}

/**
 * Ensures each category has items as an array (default []). Safe to use with
 * malformed API response (items null, missing, or non-array).
 */
export function normalizeCategoryContribution(raw: unknown): CategoryContribution[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((c: unknown) => {
    const rec = c as Record<string, unknown>;
    return {
      categoryName: typeof rec.categoryName === 'string' ? rec.categoryName : '',
      items: Array.isArray(rec.items)
        ? (rec.items as unknown[]).map((item: unknown) => {
            const row = item as Record<string, unknown>;
            return {
              itemName: typeof row.itemName === 'string' ? row.itemName : '',
              quantity: typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 0,
            };
          })
        : [],
    };
  });
}

/**
 * True when there is nothing to show: empty array or every category has no items.
 */
export function hasNoUsableData(categories: CategoryContribution[]): boolean {
  if (categories.length === 0) return true;
  return categories.every((c) => c.items.length === 0);
}
