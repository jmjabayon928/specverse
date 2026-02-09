// src/backend/routes/estimationRoutes.ts
import { Router } from 'express'
import { verifyToken, requirePermission } from '../middleware/authMiddleware'
import { PERMISSIONS } from '@/constants/permissions'
import * as controller from '../controllers/estimationController'

const router = Router()

// ======================
// Reference dropdowns
// ======================
router.get('/clients', verifyToken, controller.getClientListHandler)
router.get('/projects', verifyToken, controller.getProjectListHandler)

// ======================
// Packages (order before :id)
// ======================
router.get('/packages/all', verifyToken, controller.getAllPackagesHandler)
router.get('/packages', verifyToken, controller.getPackagesByEstimationIdHandler)
router.get('/packages/:id', verifyToken, controller.getPackageByIdHandler)
router.post('/packages/create', verifyToken, controller.createPackageHandler)
router.put('/packages/:id', verifyToken, controller.updatePackageHandler)
router.delete('/packages/:id', verifyToken, controller.deletePackageHandler)

// ======================
// Items
// ======================
router.get('/items', verifyToken, controller.getItemsByPackageIdHandler)
router.post('/items/create', verifyToken, controller.createItemHandler)
router.put('/items/:id', verifyToken, controller.updateItemHandler)
router.delete('/items/:id', verifyToken, controller.deleteItemHandler)

// ======================
// Quotes
// ======================
router.get('/quotes/all', verifyToken, controller.getAllQuotesHandler)
router.get('/quotes', verifyToken, controller.getQuotesByItemIdHandler)
router.post('/quotes/create', verifyToken, controller.createSupplierQuoteHandler)
router.put('/quotes/:id', verifyToken, controller.updateSupplierQuoteHandler)
router.delete('/quotes/:id', verifyToken, controller.deleteSupplierQuoteHandler)
router.post(
  '/quotes/select/:quoteId',
  verifyToken,
  controller.selectWinningQuoteHandler
)

// ======================
// Core Estimation CRUD (static /history before param :id)
// ======================
router.get('/', verifyToken, controller.getAllEstimationsHandler)
router.get('/history', verifyToken, controller.getPastEstimationsHandler)
router.get('/:id', verifyToken, controller.getEstimationByIdHandler)
router.post('/', verifyToken, controller.createEstimationHandler)
router.put('/:id', verifyToken, controller.updateEstimationHandler)
router.delete('/:id', verifyToken, requirePermission(PERMISSIONS.ESTIMATION_DELETE), controller.deleteEstimationHandler)

// ======================
// Filtering
// ======================
router.post('/filter', verifyToken, controller.getFilteredEstimationsHandler)

// ======================
// Filter export
// ======================
router.post(
  '/export/filter/pdf',
  verifyToken,
  controller.exportFilteredEstimationsPDFHandler
)

// ======================
// PDF exports
// ======================
router.get('/export/:id/pdf', verifyToken, controller.exportEstimationPDFHandler)
router.get(
  '/export/:id/summary-pdf',
  verifyToken,
  controller.exportEstimationSummaryPDFHandler
)
router.get(
  '/export/estimation-procurement/:id/pdf',
  verifyToken,
  controller.exportEstimationProcurementPDFHandler
)
router.get(
  '/export/package-procurement/:packageId/pdf',
  verifyToken,
  controller.exportPackageProcurementPDFHandler
)

// ======================
// Excel exports
// ======================
router.get(
  '/export/:id/excel',
  verifyToken,
  controller.exportEstimationExcelHandler
)
router.get(
  '/export/:id/summary-excel',
  verifyToken,
  controller.exportEstimationSummaryExcelHandler
)
router.get(
  '/export/estimation-procurement/:id/excel',
  verifyToken,
  controller.exportEstimationProcurementExcelHandler
)
router.get(
  '/export/package-procurement/:packageId/excel',
  verifyToken,
  controller.exportPackageProcurementExcelHandler
)

export default router
