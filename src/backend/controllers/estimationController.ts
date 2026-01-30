// src/backend/controllers/estimationController.ts

import type { RequestHandler } from 'express'
import { z } from 'zod'
import type { SupplierQuoteUpdateResponse } from '@/domain/estimations/estimationTypes'
import { poolPromise, sql } from '../config/db'
import { AppError } from '../errors/AppError'
import {
  getAllEstimations,
  getEstimationById,
  createEstimation,
  updateEstimation,
  getFilteredEstimationsWithPagination
} from '../database/estimationQueries'
import {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage
} from '../database/estimationPackageQueries'
import { createItem } from '../database/estimationItemQueries'
import {
  getQuotesByItemId,
  createSupplierQuote,
  selectSupplierQuote
} from '../database/estimationQuoteQueries'
import {
  generateEstimationPDF,
  generateEstimationSummaryPDF,
  generatePackageProcurementPDF,
  generateEstimationProcurementPDF,
  generateEstimationExcel,
  generateEstimationSummaryExcel,
  generatePackageProcurementExcel,
  generateEstimationProcurementExcel,
  generateFilteredEstimationPDF
} from '../services/estimation/export/estimationExportService'

// ========================
// Zod helpers
// ========================

const numericIdSchema = z.coerce.number().int().positive()

const parseRouteId = (raw: unknown, name: string): number => {
  try {
    return numericIdSchema.parse(raw)
  } catch {
    throw new AppError(`Invalid ${name}`, 400)
  }
}

const parseIdFromQuery = (value: unknown, fieldName: string): number => {
  if (typeof value === 'string' || typeof value === 'number') {
    return parseRouteId(value, fieldName)
  }

  if (Array.isArray(value)) {
    const first = value[0]

    if (typeof first === 'string' || typeof first === 'number') {
      return parseRouteId(first, fieldName)
    }
  }

  throw new AppError(`Invalid ${fieldName}`, 400)
}

// Estimation bodies

const createEstimationBodySchema = z
  .object({
    ProjectID: z.coerce.number().int().positive(),
    ClientID: z.coerce.number().int().positive(),
    Title: z.string().min(1, 'Title is required'),
    Description: z.string().optional(),
    CreatedBy: z.coerce.number().int().positive().optional()
  })
  .passthrough()

const updateEstimationBodySchema = z
  .object({
    Title: z.string().min(1, 'Title is required'),
    Description: z.string().optional(),
    ProjectID: z.coerce.number().int().positive().optional()
  })
  .passthrough()

const filterEstimationsBodySchema = z.object({
  statuses: z.array(z.string()).optional(),
  clients: z.array(z.union([z.string(), z.number()])).optional(),
  projects: z.array(z.union([z.string(), z.number()])).optional(),
  search: z.string().optional(),
  page: z.union([z.number(), z.string()]).optional(),
  pageSize: z.union([z.number(), z.string()]).optional()
})

// Package bodies

const createPackageBodySchema = z
  .object({
    EstimationID: z.coerce.number().int().positive(),
    PackageName: z.string().min(1, 'PackageName is required'),
    Description: z.string().optional()
  })
  .passthrough()

const updatePackageBodySchema = z
  .object({
    PackageName: z.string().min(1, 'PackageName is required'),
    Description: z.string().optional(),
    Sequence: z.coerce.number().int(),
    ModifiedBy: z.coerce.number().int().optional()
  })
  .passthrough()

// Items

const updateItemBodySchema = z
  .object({
    Quantity: z.coerce.number().positive(),
    Description: z.string().optional()
  })
  .passthrough()

// Quotes

const createSupplierQuoteBodySchema = z
  .object({
    ItemID: z.coerce.number().int().positive(),
    SupplierID: z.coerce.number().int().positive(),
    QuotedUnitCost: z.coerce.number().nonnegative(),
    ExpectedDeliveryDays: z.coerce.number().int().nonnegative(),
    CurrencyCode: z.string().min(1),
    Notes: z.string().optional()
  })
  .passthrough()

const updateSupplierQuoteBodySchema = z
  .object({
    QuotedUnitCost: z.coerce.number().nonnegative(),
    ExpectedDeliveryDays: z.coerce.number().int().nonnegative(),
    CurrencyCode: z.string().min(1),
    IsSelected: z.boolean(),
    Notes: z.string().optional()
  })
  .passthrough()

// ========================
// CRUD – Estimations
// ========================

export const getAllEstimationsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllEstimations()
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createEstimationHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = createEstimationBodySchema.parse(req.body)
    const data = await createEstimation(body)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export const getEstimationByIdHandler: RequestHandler = async (req, res, next) => {
  try {
    const id = parseRouteId(req.params.id, 'EstimationID')
    const data = await getEstimationById(id)

    if (!data) {
      throw new AppError('Estimation not found', 404)
    }

    res.status(200).json(data)
  } catch (error) {
    next(error)
  }
}

export const updateEstimationHandler: RequestHandler = async (req, res, next) => {
  try {
    const id = parseRouteId(req.params.id, 'EstimationID')
    const body = updateEstimationBodySchema.parse(req.body)

    const data = await updateEstimation(id, body)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const deleteEstimationHandler: RequestHandler = async (req, res, next) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const pool = await poolPromise

    await pool
      .request()
      .input('EstimationID', sql.Int, estimationId)
      .query(`
        DELETE FROM EstimationItems
        WHERE EstimationID = @EstimationID;

        DELETE FROM EstimationPackages
        WHERE EstimationID = @EstimationID;

        DELETE FROM EstimationSuppliers
        WHERE EstimationID = @EstimationID;

        DELETE FROM EstimationItemSupplierQuotes
        WHERE EstimationID = @EstimationID;

        DELETE FROM Estimations
        WHERE EstimationID = @EstimationID;
      `)

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// ========================
// Filtering + history
// ========================

export const getFilteredEstimationsHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = filterEstimationsBodySchema.parse(req.body ?? {})

    const statuses = parsed.statuses ?? []
    const clients = parsed.clients ?? []
    const projects = parsed.projects ?? []
    const search = parsed.search ?? ''
    const page = parsed.page ?? 1
    const pageSize = parsed.pageSize ?? 10

    const statusArray: string[] = Array.isArray(statuses)
      ? statuses.map(String)
      : []

    const clientArray: number[] = Array.isArray(clients)
      ? clients
          .map((c) => Number.parseInt(String(c), 10))
          .filter((value) => !Number.isNaN(value))
      : []

    const projectArray: number[] = Array.isArray(projects)
      ? projects
          .map((p) => Number.parseInt(String(p), 10))
          .filter((value) => !Number.isNaN(value))
      : []

    const numericPage = Number.parseInt(String(page), 10) || 1
    const numericPageSize = Number.parseInt(String(pageSize), 10) || 10

    const { estimations, totalCount } = await getFilteredEstimationsWithPagination(
      statusArray,
      clientArray,
      projectArray,
      search,
      numericPage,
      numericPageSize
    )

    res.json({ data: estimations, totalCount })
  } catch (error) {
    next(error)
  }
}

export const getPastEstimationsHandler: RequestHandler = async (_req, res, next) => {
  try {
    const pool = await poolPromise

    const result = await pool.request().query(`
      SELECT
        e.EstimationID,
        e.Title,
        e.Status,
        e.CreatedAt,
        e.CreatedBy,
        PreparedBy = u.FirstName + ' ' + u.LastName,
        ItemCount = (SELECT COUNT(*) FROM EstimationItems ei WHERE ei.EstimationID = e.EstimationID),
        TotalCost = COALESCE(e.TotalMaterialCost, 0) + COALESCE(e.TotalLaborCost, 0),
        LastModified = (SELECT MAX(dt) FROM (VALUES (e.CreatedAt), (e.VerifiedAt), (e.ApprovedAt)) v(dt))
      FROM Estimations e
      LEFT JOIN Users u ON e.CreatedBy = u.UserID
      ORDER BY e.CreatedAt DESC
    `)

    const rows = (result.recordset as Array<{
      EstimationID: number
      Title: string
      Status: string
      CreatedAt: Date
      CreatedBy: number | null
      PreparedBy: string | null
      ItemCount: number
      TotalCost: number
      LastModified: Date | null
    }>).map((r) => ({
      EstimationID: r.EstimationID,
      Title: r.Title,
      Status: r.Status,
      CreatedAt: r.CreatedAt instanceof Date ? r.CreatedAt.toISOString() : String(r.CreatedAt),
      CreatedBy: r.CreatedBy ?? null,
      PreparedBy: r.PreparedBy ?? null,
      ItemCount: r.ItemCount,
      TotalCost: r.TotalCost,
      LastModified: r.LastModified instanceof Date ? r.LastModified.toISOString() : (r.LastModified == null ? null : String(r.LastModified))
    }))

    res.json(rows)
  } catch (error) {
    next(error)
  }
}

// ========================
// PDF / Excel exports
// ========================

export const exportEstimationPDFHandler: RequestHandler = async (req, res, next) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationPDF(estimationId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_${estimationId}.pdf"`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportEstimationSummaryPDFHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationSummaryPDF(estimationId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_summary_${estimationId}.pdf"`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportEstimationProcurementPDFHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationProcurementPDF(estimationId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_procurement_${estimationId}.pdf"`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportPackageProcurementPDFHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const packageId = parseRouteId(req.params.packageId, 'PackageID')

    const buffer = await generatePackageProcurementPDF(packageId)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="package_procurement_${packageId}.pdf"`
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportEstimationExcelHandler: RequestHandler = async (req, res, next) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationExcel(estimationId)

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_${estimationId}.xlsx"`
    )
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportEstimationSummaryExcelHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationSummaryExcel(estimationId)

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_summary_${estimationId}.xlsx"`
    )
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportEstimationProcurementExcelHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const estimationId = parseRouteId(req.params.id, 'EstimationID')

    const buffer = await generateEstimationProcurementExcel(estimationId)

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estimation_procurement_${estimationId}.xlsx"`
    )
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportPackageProcurementExcelHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const packageId = parseRouteId(req.params.packageId, 'PackageID')

    const buffer = await generatePackageProcurementExcel(packageId)

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="package_procurement_${packageId}.xlsx"`
    )
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportFilteredEstimationsPDFHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const parsed = filterEstimationsBodySchema.parse(req.body ?? {})

    const statuses = parsed.statuses ?? []
    const clients = parsed.clients ?? []
    const projects = parsed.projects ?? []
    const search = parsed.search ?? ''

    const statusArray: string[] = Array.isArray(statuses)
      ? statuses.map(String)
      : []

    const clientArray: number[] = Array.isArray(clients)
      ? clients
          .map((c) => Number.parseInt(String(c), 10))
          .filter((value) => !Number.isNaN(value))
      : []

    const projectArray: number[] = Array.isArray(projects)
      ? projects
          .map((p) => Number.parseInt(String(p), 10))
          .filter((value) => !Number.isNaN(value))
      : []

    const buffer = await generateFilteredEstimationPDF(
      statusArray,
      clientArray,
      projectArray,
      search
    )

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="filtered_estimations.pdf"'
    )
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

// ========================
// Packages
// ========================

export const getAllPackagesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const data = await getAllPackages()
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const getPackagesByEstimationIdHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const estimationId = parseIdFromQuery(req.query.estimationId, 'EstimationID')

    const pool = await poolPromise

    const result = await pool
      .request()
      .input('EstimationID', sql.Int, estimationId)
      .query(`
        SELECT 
          p.PackageID,
          p.EstimationID,
          p.PackageName,
          p.Description,
          p.TotalMaterialCost,
          p.TotalLaborCost,
          p.TotalDurationDays,
          p.CreatedAt,
          p.CreatedBy,
          cb.FirstName + ' ' + cb.LastName AS CreatedByName,
          p.ModifiedAt,
          p.ModifiedBy,
          mb.FirstName + ' ' + mb.LastName AS ModifiedByName
        FROM EstimationPackages p
        LEFT JOIN Users cb ON p.CreatedBy = cb.UserID
        LEFT JOIN Users mb ON p.ModifiedBy = mb.UserID
        WHERE p.EstimationID = @EstimationID
        ORDER BY p.PackageID
      `)

    res.status(200).json(result.recordset)
  } catch (error) {
    next(error)
  }
}

export const getPackageByIdHandler: RequestHandler = async (req, res, next) => {
  try {
    const packageId = parseRouteId(req.params.id, 'PackageID')

    const data = await getPackageById(packageId)
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createPackageHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = createPackageBodySchema.parse(req.body)

    const created = await createPackage({
      EstimationID: body.EstimationID,
      PackageName: body.PackageName.trim(),
      Description: body.Description
    })

    res.status(201).json(created)
  } catch (error) {
    next(error)
  }
}

export const updatePackageHandler: RequestHandler = async (req, res, next) => {
  try {
    const packageId = parseRouteId(req.params.id, 'PackageID')
    const payload = updatePackageBodySchema.parse(req.body)

    const updated = await updatePackage(packageId, {
      ...payload,
      PackageName: payload.PackageName.trim(),
      Description: payload.Description ?? undefined
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
}

export const deletePackageHandler: RequestHandler = async (req, res, next) => {
  try {
    const packageId = parseRouteId(req.params.id, 'PackageID')

    await deletePackage(packageId)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// ========================
// Items
// ========================

export const getItemsByPackageIdHandler: RequestHandler = async (req, res, next) => {
  try {
    const packageId = parseIdFromQuery(req.query.packageId, 'PackageID')

    const pool = await poolPromise

    const result = await pool
      .request()
      .input('PackageID', sql.Int, packageId)
      .query(`
        SELECT 
          ei.EItemID,
          ei.EstimationID,
          ei.PackageID,
          ei.ItemID,
          ei.Quantity,
          ei.Description,
          ei.CreatedAt,
          ei.CreatedBy,
          u.FirstName + ' ' + u.LastName AS CreatedByName,
          i.ItemName,
          i.UnitCost
        FROM EstimationItems ei
        LEFT JOIN InventoryItems i ON ei.ItemID = i.InventoryItemID
        LEFT JOIN Users u ON ei.CreatedBy = u.UserID
        WHERE ei.PackageID = @PackageID
      `)

    res.json(result.recordset)
  } catch (error) {
    next(error)
  }
}

export const createItemHandler: RequestHandler = async (req, res, next) => {
  try {
    // keep shape flexible for now (createItem has its own typing/validation)
    const createdItem = await createItem(req.body)
    res.status(201).json(createdItem)
  } catch (error) {
    next(error)
  }
}

export const updateItemHandler: RequestHandler = async (req, res, next) => {
  try {
    const itemId = parseRouteId(req.params.id, 'ItemID')
    const body = updateItemBodySchema.parse(req.body)

    const pool = await poolPromise

    const result = await pool
      .request()
      .input('EItemID', sql.Int, itemId)
      .input('Quantity', sql.Int, body.Quantity)
      .input('Description', sql.NVarChar(1000), body.Description ?? '')
      .query(`
        UPDATE EstimationItems
        SET Quantity = @Quantity,
            Description = @Description
        WHERE EItemID = @EItemID;

        SELECT 
          ei.EItemID,
          ei.EstimationID,
          ei.PackageID,
          ei.ItemID,
          ei.Quantity,
          ei.Description,
          ei.CreatedAt,
          ei.CreatedBy,
          u.FirstName + ' ' + u.LastName AS CreatedByName,
          i.ItemName,
          i.UnitCost
        FROM EstimationItems ei
        LEFT JOIN InventoryItems i ON ei.ItemID = i.InventoryItemID
        LEFT JOIN Users u ON ei.CreatedBy = u.UserID
        WHERE ei.EItemID = @EItemID
      `)

    if (result.recordset.length === 0) {
      throw new AppError('Item not found', 404)
    }

    res.json(result.recordset[0])
  } catch (error) {
    next(error)
  }
}

export const deleteItemHandler: RequestHandler = async (req, res, next) => {
  try {
    const itemId = parseRouteId(req.params.id, 'ItemID')

    const pool = await poolPromise

    await pool
      .request()
      .input('EItemID', sql.Int, itemId)
      .query(`
        DELETE FROM EstimationItemSupplierQuotes
        WHERE ItemID = @EItemID;

        DELETE FROM EstimationItems
        WHERE EItemID = @EItemID;
      `)

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

// ========================
// Quotes
// ========================

export const getAllQuotesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const pool = await poolPromise

    const result = await pool.request().query(`
      SELECT TOP (100)
        q.QuoteID AS QuoteRowID,
        q.QuoteID,
        q.ItemID,
        q.SupplierID,
        q.QuotedUnitCost,
        q.ExpectedDeliveryDays,
        q.CurrencyCode,
        q.IsSelected,
        q.Notes,
        s.SupplierQuoteReference,
        s.TotalQuotedCost,
        s.CurrencyCode AS SupplierCurrency,
        s.ExpectedDeliveryDays AS SupplierDeliveryDays,
        i.ItemName,
        sup.SuppName AS SupplierName
      FROM EstimationItemSupplierQuotes q
        LEFT JOIN EstimationItems ei ON q.ItemID = ei.EItemID
        LEFT JOIN EstimationSuppliers s
          ON q.SupplierID = s.SupplierID
          AND ei.EstimationID = s.EstimationID
        LEFT JOIN InventoryItems i ON ei.ItemID = i.InventoryItemID
        LEFT JOIN Suppliers sup ON q.SupplierID = sup.SuppID
    `)

    const quotes = result.recordset.map((row) => ({
      QuoteRowID: row.QuoteRowID,
      QuoteID: row.QuoteID,
      ItemID: row.ItemID,
      SupplierID: row.SupplierID,
      QuotedUnitCost: row.QuotedUnitCost,
      ExpectedDeliveryDays: row.ExpectedDeliveryDays,
      CurrencyCode: row.CurrencyCode,
      IsSelected: row.IsSelected,
      Notes: row.Notes,
      SupplierQuoteReference: row.SupplierQuoteReference,
      TotalQuotedCost: row.TotalQuotedCost,
      SupplierCurrency: row.SupplierCurrency,
      SupplierDeliveryDays: row.SupplierDeliveryDays,
      ItemName: row.ItemName,
      SupplierName: row.SupplierName
    }))

    res.json(quotes)
  } catch (error) {
    next(error)
  }
}

export const getQuotesByItemIdHandler: RequestHandler = async (req, res, next) => {
  try {
    const itemId = parseIdFromQuery(req.query.itemId, 'ItemID')

    const quotes = await getQuotesByItemId(itemId)
    res.json(quotes)
  } catch (error) {
    next(error)
  }
}

export const createSupplierQuoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const body = createSupplierQuoteBodySchema.parse(req.body)
    const createdQuote = await createSupplierQuote(body)
    res.status(201).json(createdQuote)
  } catch (error) {
    next(error)
  }
}

export const updateSupplierQuoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const quoteId = parseRouteId(req.params.id, 'QuoteID')
    const body = updateSupplierQuoteBodySchema.parse(req.body)

    const pool = await poolPromise

    const result = await pool
      .request()
      .input('QuoteID', sql.Int, quoteId)
      .input('QuotedUnitCost', sql.Decimal(18, 2), body.QuotedUnitCost)
      .input('ExpectedDeliveryDays', sql.Int, body.ExpectedDeliveryDays)
      .input('CurrencyCode', sql.NVarChar(10), body.CurrencyCode)
      .input('IsSelected', sql.Bit, body.IsSelected)
      .input('Notes', sql.NVarChar(sql.MAX), body.Notes ?? null)
      .query(`
        UPDATE EstimationItemSupplierQuotes
        SET
          QuotedUnitCost = @QuotedUnitCost,
          ExpectedDeliveryDays = @ExpectedDeliveryDays,
          CurrencyCode = @CurrencyCode,
          IsSelected = @IsSelected,
          Notes = @Notes
        WHERE QuoteID = @QuoteID;

        SELECT *
        FROM EstimationItemSupplierQuotes
        WHERE QuoteID = @QuoteID
      `)

    if (result.recordset.length === 0) {
      throw new AppError('Quote not found', 404)
    }

    const row = result.recordset[0] as {
      QuoteID: unknown
      ItemID: unknown
      SupplierID: unknown
      QuotedUnitCost: unknown
      ExpectedDeliveryDays: unknown
      CurrencyCode: unknown
      IsSelected: unknown
      Notes: unknown
    }
    const quoteIdFromRow = Number(row.QuoteID)
    if (typeof quoteIdFromRow !== 'number' || Number.isNaN(quoteIdFromRow)) {
      throw new AppError('Invalid quote row: QuoteID is not a number', 500)
    }

    const payload: SupplierQuoteUpdateResponse = {
      QuoteRowID: quoteIdFromRow,
      QuoteID: quoteIdFromRow,
      ItemID: Number(row.ItemID),
      SupplierID: Number(row.SupplierID),
      QuotedUnitCost: Number(row.QuotedUnitCost),
      ExpectedDeliveryDays: row.ExpectedDeliveryDays != null ? Number(row.ExpectedDeliveryDays) : 0,
      CurrencyCode: typeof row.CurrencyCode === 'string' ? row.CurrencyCode : '',
      IsSelected: Boolean(row.IsSelected),
      Notes: row.Notes != null ? String(row.Notes) : ''
    }
    res.json(payload)
  } catch (error) {
    next(error)
  }
}

export const deleteSupplierQuoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const quoteId = parseRouteId(req.params.id, 'QuoteID')

    const pool = await poolPromise

    await pool
      .request()
      .input('QuoteID', sql.Int, quoteId)
      .query(`
        DELETE FROM EstimationItemSupplierQuotes
        WHERE QuoteID = @QuoteID
      `)

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export const selectWinningQuoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const quoteId = parseRouteId(req.params.quoteId, 'QuoteID')

    const updated = await selectSupplierQuote(quoteId)
    res.json(updated)
  } catch (error) {
    next(error)
  }
}

// ========================
// Reference lookups
// ========================

export const getClientListHandler: RequestHandler = async (_req, res, next) => {
  try {
    const pool = await poolPromise

    const result = await pool.request().query(`
      SELECT ClientID, ClientName
      FROM Clients
      ORDER BY ClientName
    `)

    res.json(result.recordset)
  } catch (error) {
    next(error)
  }
}

export const getProjectListHandler: RequestHandler = async (_req, res, next) => {
  try {
    const pool = await poolPromise

    const result = await pool.request().query(`
      SELECT ProjectID, ProjName AS ProjectName
      FROM Projects
      ORDER BY ProjName
    `)

    res.json(result.recordset)
  } catch (error) {
    next(error)
  }
}
