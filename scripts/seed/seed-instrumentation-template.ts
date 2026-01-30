/**
 * Phase 1 Chunk 5: Seed "Instrument Datasheet – Pressure Transmitter" template.
 * Run manually after chunk5-seeds.sql (Disciplines + DatasheetSubtypes).
 * Usage (from project root): npx tsx scripts/seed/seed-instrumentation-template.ts
 * Requires: .env with DB_* and at least one Category, User, Client, Project, Area, Manufacturer, Supplier.
 */

import dotenv from 'dotenv'
import path from 'path'

// Load .env from project root (run from project root)
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

// Use relative path to avoid path aliases; db.ts has no @/ imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../../src/backend/config/db')
const poolPromise = db.poolPromise as Promise<import('mssql').ConnectionPool>
const sql = db.sql as typeof import('mssql')

type RefIds = {
  categoryId: number
  userId: number
  clientId: number
  projectId: number
  areaId: number
  manuId: number
  suppId: number
  disciplineId: number
  subtypeId: number
}

interface SubsheetDef {
  name: string
  fields: Array<{
    label: string
    infoType: 'int' | 'decimal' | 'varchar'
    uom?: string
    required?: boolean
    options?: string[]
  }>
}

async function getRefIds(pool: import('mssql').ConnectionPool): Promise<RefIds | null> {
  const [cat, usr, client, proj, area, manu, supp, disc, sub] = await Promise.all([
    pool.request().query<{ CategoryID: number }>(`SELECT TOP 1 CategoryID FROM Categories ORDER BY CategoryID`),
    pool.request().query<{ UserID: number }>(`SELECT TOP 1 UserID FROM Users ORDER BY UserID`),
    pool.request().query<{ ClientID: number }>(`SELECT TOP 1 ClientID FROM Clients ORDER BY ClientID`),
    pool.request().query<{ ProjectID: number }>(`SELECT TOP 1 ProjectID FROM Projects ORDER BY ProjectID`),
    pool.request().query<{ AreaID: number }>(`SELECT TOP 1 AreaID FROM Areas ORDER BY AreaID`),
    pool.request().query<{ ManuID: number }>(`SELECT TOP 1 ManuID FROM Manufacturers ORDER BY ManuID`),
    pool.request().query<{ SuppID: number }>(`SELECT TOP 1 SuppID FROM Suppliers ORDER BY SuppID`),
    pool.request().query<{ DisciplineID: number }>(`SELECT DisciplineID FROM dbo.Disciplines WHERE DisciplineName = N'INSTRUMENTATION'`),
    pool.request().query<{ DatasheetSubtypeID: number }>(`SELECT ds.DatasheetSubtypeID FROM dbo.DatasheetSubtypes ds JOIN dbo.Disciplines d ON d.DisciplineID = ds.DisciplineID WHERE d.DisciplineName = N'INSTRUMENTATION' AND ds.SubtypeName = N'PRESSURE_TRANSMITTER'`),
  ])

  const categoryId = cat.recordset[0]?.CategoryID
  const userId = usr.recordset[0]?.UserID
  const clientId = client.recordset[0]?.ClientID
  const projectId = proj.recordset[0]?.ProjectID
  const areaId = area.recordset[0]?.AreaID
  const manuId = manu.recordset[0]?.ManuID
  const suppId = supp.recordset[0]?.SuppID
  const disciplineId = disc.recordset[0]?.DisciplineID
  const subtypeId = sub.recordset[0]?.DatasheetSubtypeID

  if (
    categoryId == null ||
    userId == null ||
    clientId == null ||
    projectId == null ||
    areaId == null ||
    manuId == null ||
    suppId == null ||
    disciplineId == null ||
    subtypeId == null
  ) {
    return null
  }

  return {
    categoryId,
    userId,
    clientId,
    projectId,
    areaId,
    manuId,
    suppId,
    disciplineId,
    subtypeId,
  }
}

function buildSubsheets(): SubsheetDef[] {
  return [
    {
      name: 'Process Data',
      fields: [
        { label: 'Process fluid', infoType: 'varchar', required: true },
        { label: 'Min operating pressure', infoType: 'decimal', uom: 'kPa(g)', required: true },
        { label: 'Max operating pressure', infoType: 'decimal', uom: 'kPa(g)', required: true },
        { label: 'Operating temperature min', infoType: 'decimal', uom: '°C' },
        { label: 'Operating temperature max', infoType: 'decimal', uom: '°C' },
        { label: 'Specific gravity', infoType: 'decimal' },
      ],
    },
    {
      name: 'Electrical/Signal',
      fields: [
        { label: 'Supply voltage', infoType: 'varchar', required: true },
        { label: 'Output signal', infoType: 'varchar', options: ['4–20 mA', 'HART', 'Foundation Fieldbus', 'Profibus PA'], required: true },
        { label: 'Electrical connection', infoType: 'varchar' },
        { label: 'Protection class', infoType: 'varchar' },
      ],
    },
    {
      name: 'Mechanical/Connections',
      fields: [
        { label: 'Process connection', infoType: 'varchar', required: true },
        { label: 'Material of construction', infoType: 'varchar' },
        { label: 'Wetted parts material', infoType: 'varchar' },
        { label: 'Mounting', infoType: 'varchar' },
        { label: 'Weight', infoType: 'decimal', uom: 'kg' },
      ],
    },
    {
      name: 'Materials',
      fields: [
        { label: 'Body material', infoType: 'varchar' },
        { label: 'Diaphragm material', infoType: 'varchar' },
        { label: 'O-ring material', infoType: 'varchar' },
        { label: 'Coating', infoType: 'varchar' },
      ],
    },
    {
      name: 'Certifications/Notes',
      fields: [
        { label: 'Certifications', infoType: 'varchar' },
        { label: 'Remarks', infoType: 'varchar' },
      ],
    },
  ]
}

async function main(): Promise<void> {
  const pool = await poolPromise

  const refs = await getRefIds(pool)
  if (!refs) {
    console.error(
      'Missing reference data. Ensure: (1) chunk5-seeds.sql was run; (2) at least one Category, User, Client, Project, Area, Manufacturer, and Supplier exist.'
    )
    process.exit(1)
  }

  const subsheets = buildSubsheets()
  const revisionDate = new Date().toISOString().slice(0, 10)

  const tx = new sql.Transaction(pool)
  await tx.begin()

  try {
    const sheetReq = tx
      .request()
      .input('SheetName', sql.VarChar(255), 'Instrument Datasheet – Pressure Transmitter')
      .input('SheetDesc', sql.VarChar(255), 'Instrument datasheet for pressure transmitter equipment')
      .input('SheetDesc2', sql.VarChar(255), '')
      .input('ClientDocNum', sql.Int, 1)
      .input('ClientProjNum', sql.Int, 1)
      .input('CompanyDocNum', sql.Int, 1)
      .input('CompanyProjNum', sql.Int, 1)
      .input('AreaID', sql.Int, refs.areaId)
      .input('PackageName', sql.VarChar(100), 'Instrumentation')
      .input('RevisionNum', sql.Int, 1)
      .input('RevisionDate', sql.Date, new Date())
      .input('PreparedByID', sql.Int, refs.userId)
      .input('PreparedByDate', sql.DateTime, new Date())
      .input('EquipmentName', sql.VarChar(150), 'Pressure Transmitter')
      .input('EquipmentTagNum', sql.VarChar(150), '')
      .input('ServiceName', sql.VarChar(150), '')
      .input('RequiredQty', sql.Int, 1)
      .input('ItemLocation', sql.VarChar(255), '')
      .input('ManuID', sql.Int, refs.manuId)
      .input('SuppID', sql.Int, refs.suppId)
      .input('InstallPackNum', sql.VarChar(100), '')
      .input('EquipSize', sql.Int, 0)
      .input('ModelNum', sql.VarChar(50), '')
      .input('Driver', sql.VarChar(150), '')
      .input('LocationDwg', sql.VarChar(255), '')
      .input('PID', sql.Int, null)
      .input('InstallDwg', sql.VarChar(255), '')
      .input('CodeStd', sql.VarChar(255), '')
      .input('CategoryID', sql.Int, refs.categoryId)
      .input('ClientID', sql.Int, refs.clientId)
      .input('ProjectID', sql.Int, refs.projectId)
      .input('DisciplineID', sql.Int, refs.disciplineId)
      .input('DatasheetSubtypeID', sql.Int, refs.subtypeId)
      .input('Status', sql.VarChar(50), 'Draft')
      .input('IsLatest', sql.Bit, 1)
      .input('IsTemplate', sql.Bit, 1)
      .input('AutoCADImport', sql.Bit, 0)

    const sheetRs = await sheetReq.query<{ SheetID: number }>(`
      INSERT INTO Sheets (
        SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
        AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
        ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
        CategoryID, ClientID, ProjectID, DisciplineID, DatasheetSubtypeID, Status, IsLatest, IsTemplate, AutoCADImport
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
        @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
        @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
        @CategoryID, @ClientID, @ProjectID, @DisciplineID, @DatasheetSubtypeID, @Status, @IsLatest, @IsTemplate, @AutoCADImport
      );
    `)

    const sheetId = sheetRs.recordset[0].SheetID

    for (let i = 0; i < subsheets.length; i++) {
      const sub = subsheets[i]
      const subRs = await tx
        .request()
        .input('SubName', sql.VarChar(150), sub.name)
        .input('SheetID', sql.Int, sheetId)
        .input('OrderIndex', sql.Int, i)
        .input('TemplateSubID', sql.Int, null)
        .query<{ SubID: number }>(`
          INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
          OUTPUT INSERTED.SubID
          VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID)
        `)

      const newSubId = subRs.recordset[0].SubID

      for (let j = 0; j < sub.fields.length; j++) {
        const f = sub.fields[j]
        const infoRs = await tx
          .request()
          .input('SubID', sql.Int, newSubId)
          .input('Label', sql.VarChar(150), f.label)
          .input('InfoType', sql.VarChar(30), f.infoType)
          .input('OrderIndex', sql.Int, j)
          .input('UOM', sql.VarChar(50), f.uom ?? '')
          .input('Required', sql.Bit, f.required ? 1 : 0)
          .input('TemplateInfoTemplateID', sql.Int, null)
          .query<{ InfoTemplateID: number }>(`
            INSERT INTO InformationTemplates (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
            OUTPUT INSERTED.InfoTemplateID
            VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID)
          `)

        const newInfoId = infoRs.recordset[0].InfoTemplateID

        if (Array.isArray(f.options) && f.options.length > 0) {
          for (let k = 0; k < f.options.length; k++) {
            await tx
              .request()
              .input('InfoTemplateID', sql.Int, newInfoId)
              .input('OptionValue', sql.VarChar(100), f.options[k])
              .input('SortOrder', sql.Int, k)
              .query(`
                INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
                VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
              `)
          }
        }
      }
    }

    await tx.commit()
    console.log(`Created template "Instrument Datasheet – Pressure Transmitter" (SheetID=${sheetId}).`)
    console.log('Verify: Templates list → Filter by Instrumentation → open template; create filled sheet; Filled list → Filter by Instrumentation.')
  } catch (err) {
    await tx.rollback()
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.close()
  }
}

main()
