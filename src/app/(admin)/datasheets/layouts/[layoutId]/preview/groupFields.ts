export type FieldOption = Readonly<{
  optionId: number;
  value: string;        // OptionValue from DB
  sortOrder?: number;   // SortOrder from DB (if any)
}>;

export type RenderField = Readonly<{
  infoTemplateId: number;
  label: string;
  value: string;
  rawValue: string | null;
  uom?: string;
  groupKey?: string;
  cellIndex?: number;
  cellCaption?: string;
  columnNumber?: 1 | 2;
  options?: ReadonlyArray<FieldOption>;
}>;

export type GroupedRow =
  | Readonly<{ kind: "single"; field: RenderField }>
  | Readonly<{
      kind: "group";
      label: string;
      uom?: string;
      cells: ReadonlyArray<
        Readonly<{
          key: string;
          caption?: string;
          value: string;
        }>
      >;
    }>;

export type GroupOptions = Readonly<{ preserveOrder?: boolean }>;

type GroupBucket = {
  label: string;
  uom?: string;
  cells: Array<{ key: string; caption?: string; value: string; cellIndex?: number }>;
  firstSeenWhen: number; // absolute position when the group first appeared
};

function isGroupedField(f: RenderField): f is RenderField & Required<Pick<RenderField, "groupKey">> {
  return typeof f.groupKey === "string" && f.groupKey.length > 0;
}

function buildCellKey(groupKey: string, cellIndex?: number, infoTemplateId?: number): string {
  const idx = typeof cellIndex === "number" ? String(cellIndex) : "x";
  const tid = typeof infoTemplateId === "number" ? String(infoTemplateId) : "t";
  return `${groupKey}::${idx}::${tid}`;
}

function stableByIndex<T extends { cellIndex?: number }>(arr: ReadonlyArray<T>): T[] {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ai = typeof a.v.cellIndex === "number" ? a.v.cellIndex : Number.MAX_SAFE_INTEGER;
      const bi = typeof b.v.cellIndex === "number" ? b.v.cellIndex : Number.MAX_SAFE_INTEGER;
      return ai === bi ? a.i - b.i : ai - bi;
    })
    .map((x) => x.v);
}

function orderGroupCells(
  cells: ReadonlyArray<{ key: string; caption?: string; value: string; cellIndex?: number }>
): ReadonlyArray<{ key: string; caption?: string; value: string }> {
  const allIndexed = cells.every((c) => typeof c.cellIndex === "number");
  const ordered = allIndexed ? stableByIndex(cells) : [...cells];
  return ordered.map(({ key, caption, value }) => ({ key, caption, value }));
}

// --- helpers kept local to reduce complexity ---
function getOrCreateBucket(
  map: Map<string, GroupBucket>,
  key: string,
  label: string,
  uom: string | undefined,
  firstSeenWhen: number
): GroupBucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { label, uom, cells: [], firstSeenWhen };
    map.set(key, bucket);
  }
  return bucket;
}

function pushCell(
  bucket: GroupBucket,
  f: RenderField
): void {
  bucket.cells.push({
    key: buildCellKey(f.groupKey as string, f.cellIndex, f.infoTemplateId),
    caption: f.cellCaption,
    value: f.value ?? "",
    cellIndex: typeof f.cellIndex === "number" ? f.cellIndex : undefined,
  });
}

function groupFieldsNoPreserve(
  fields: ReadonlyArray<RenderField>
): ReadonlyArray<GroupedRow> {
  const singles: GroupedRow[] = [];
  const groups = new Map<string, GroupBucket>();

  for (const f of fields) {
    if (!isGroupedField(f)) {
      singles.push({ kind: "single", field: f });
      continue;
    }
    const bucket = getOrCreateBucket(groups, f.groupKey, f.label, f.uom, 0);
    pushCell(bucket, f);
  }

  const groupedRows = [...groups.values()].map<GroupedRow>((bucket) => ({
    kind: "group",
    label: bucket.label,
    uom: bucket.uom,
    cells: orderGroupCells(bucket.cells),
  }));

  return [...singles, ...groupedRows];
}

function groupFieldsPreserve(
  fields: ReadonlyArray<RenderField>
): ReadonlyArray<GroupedRow> {
  const groups = new Map<string, GroupBucket>();
  const rowsWithWhen: Array<{ when: number; row: GroupedRow }> = [];
  let cursor = 0;

  for (const f of fields) {
    cursor += 1;
    if (!isGroupedField(f)) {
      rowsWithWhen.push({ when: cursor, row: { kind: "single", field: f } });
      continue;
    }
    const bucket = getOrCreateBucket(groups, f.groupKey, f.label, f.uom, cursor);
    pushCell(bucket, f);
  }

  for (const bucket of groups.values()) {
    rowsWithWhen.push({
      when: bucket.firstSeenWhen,
      row: {
        kind: "group",
        label: bucket.label,
        uom: bucket.uom,
        cells: orderGroupCells(bucket.cells),
      },
    });
  }

  rowsWithWhen.sort((a, b) => a.when - b.when);
  return rowsWithWhen.map((x) => x.row);
}

// --- tiny public function (low complexity) ---
export function groupFields(
  fields: ReadonlyArray<RenderField>,
  opts?: GroupOptions
): ReadonlyArray<GroupedRow> {
  const preserve = opts?.preserveOrder === true;
  return preserve ? groupFieldsPreserve(fields) : groupFieldsNoPreserve(fields);
}
