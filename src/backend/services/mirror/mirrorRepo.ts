import { poolPromise, sql } from "@/backend/config/db";
import { SheetDefinitionJSON } from "@/domain/i18n/mirrorTypes";

export async function upsertMirrorTemplate(def: SheetDefinitionJSON): Promise<void> {
  const pool = await poolPromise;
  const q = `
MERGE dbo.MirrorTemplates AS T
USING (SELECT @Id AS Id) AS S
ON (T.Id = S.Id)
WHEN MATCHED THEN
  UPDATE SET ClientKey=@ClientKey, SourceKind=@SourceKind, DefinitionJson=@DefinitionJson, UpdatedAt=SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (Id, ClientKey, SourceKind, DefinitionJson, CreatedAt, UpdatedAt)
  VALUES (@Id, @ClientKey, @SourceKind, @DefinitionJson, SYSUTCDATETIME(), SYSUTCDATETIME());
`;
  const r = pool.request();
  r.input("Id", def.id);
  r.input("ClientKey", sql.NVarChar(128), def.clientKey);
  r.input("SourceKind", sql.NVarChar(16), def.sourceKind);
  r.input("DefinitionJson", sql.NVarChar(sql.MAX), JSON.stringify(def));
  await r.query(q);
}

export async function getMirrorTemplate(id: string): Promise<SheetDefinitionJSON | null> {
  const pool = await poolPromise;
  const r = pool.request();
  r.input("Id", id);
  const res = await r.query<{ DefinitionJson: string }>(
    "SELECT DefinitionJson FROM dbo.MirrorTemplates WHERE Id = @Id"
  );
  if (!res.recordset[0]) return null;
  return JSON.parse(res.recordset[0].DefinitionJson) as SheetDefinitionJSON;
}
