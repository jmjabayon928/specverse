// src/backend/app.ts
import express, { type Application, type Request, type Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'

// Routes
import usersRoutes from './routes/usersRoutes'
import rolesRoutes from './routes/rolesRoutes'
import permissionsRoutes from './routes/permissionsRoutes'
import clientsRoutes from './routes/clientsRoutes'
import manufacturersRoutes from './routes/manufacturersRoutes'
import suppliersRoutes from './routes/suppliersRoutes'
import categoriesRoutes from './routes/categoriesRoutes'
import layoutRoutes from './routes/layoutRoutes'
import mirrorRoutes from './routes/mirrorRoutes'
import languageRoutes from './routes/languageRoutes'
import labelRoutes from './routes/labelRoutes'
import inventoryRoutes from './routes/inventoryRoutes'
import estimationRoutes from './routes/estimationRoutes'
import templateRoutes from './routes/templateRoutes'
import filledSheetRoutes from './routes/filledSheetRoutes'
import sheetRoutes from './routes/sheetRoutes'
import projectsRoutes from './routes/projectsRoutes'
import authRoutes from './routes/authRoutes'
import sessionsRoutes from './routes/sessionsRoutes'
import accountsRoutes from './routes/accountsRoutes'
import accountMembersRoutes from './routes/accountMembersRoutes'
import rolesListRoutes from './routes/rolesListRoutes'
import notificationRoutes from './routes/notificationRoutes'
import referenceRoutes from '@/backend/routes/referenceRoutes'
import statsRoutes from './routes/statsRoutes'
import reportsRoutes from './routes/reportsRoutes'
import adminRoutes from './routes/adminRoutes'
import devRoutes from './routes/devRoutes'
import auditLogsRoutes from './routes/auditLogsRoutes'
import exportJobsRoutes from './routes/exportJobsRoutes'
import verificationRecordsRoutes from './routes/verificationRecordsRoutes'
import datasheetVerificationRecordsRoutes from './routes/datasheetVerificationRecordsRoutes'
import { errorHandler } from './middleware/errorHandler'

const app: Application = express()

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Security, compression, logging
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  }),
)
app.use(cookieParser())
app.use(helmet())
app.use(compression())
app.use(morgan('dev'))

// Routes
app.use('/api/backend/settings/users', usersRoutes)
app.use('/api/backend/settings/roles', rolesRoutes)
app.use('/api/backend/settings/permissions', permissionsRoutes)
app.use('/api/backend/settings/projects', projectsRoutes)
app.use('/api/backend/settings/clients', clientsRoutes)
app.use('/api/backend/settings/manufacturers', manufacturersRoutes)
app.use('/api/backend/settings/suppliers', suppliersRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/backend/datasheets', datasheetVerificationRecordsRoutes)
app.use('/api/backend/layouts', layoutRoutes)
app.use('/api/backend/inventory', inventoryRoutes)
app.use('/api/backend/estimation', estimationRoutes)
app.use('/api/backend/templates', templateRoutes)
app.use('/api/backend/filledsheets', filledSheetRoutes)
app.use('/api/backend/sheets', sheetRoutes)
app.use('/api/backend/projects', projectsRoutes)
app.use('/api/languages', languageRoutes)
app.use('/api/backend/auth', authRoutes)
app.use('/api/backend/sessions', sessionsRoutes)
app.use('/api/backend/accounts', accountsRoutes)
app.use('/api/backend/account-members', accountMembersRoutes)
app.use('/api/backend/roles', rolesListRoutes)
app.use('/api', labelRoutes)
app.use('/api/mirror', mirrorRoutes)
app.use('/api/backend/notifications', notificationRoutes)
app.use('/api/backend', referenceRoutes)
app.use('/api/backend/stats', statsRoutes)
app.use('/api/backend/reports', reportsRoutes)
app.use('/api/backend/admin', adminRoutes)
app.use('/api/backend/dev', devRoutes)
app.use('/api/backend/audit-logs', auditLogsRoutes)
app.use('/api/backend/exports/jobs', exportJobsRoutes)
app.use('/api/backend/verification-records', verificationRecordsRoutes)

// ─────────────────────────────────────────────
// Dev-only routes inspector
// Visit: GET /api/backend/_debug/routes
// ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  type HTTPMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
  type MethodsMap = Partial<Record<Lowercase<HTTPMethods>, boolean>>

  interface ExpressRoute {
    path?: string
    methods: MethodsMap
  }

  interface RouterStackLike {
    stack?: unknown[]
  }

  // Accepts objects and functions (Express router handle is a function with .stack)
  const isObjectLike = (
    value: unknown,
  ): value is Record<string, unknown> | ((...args: unknown[]) => unknown) => {
    if (typeof value === 'object' && value !== null) {
      return true
    }

    if (typeof value === 'function') {
      return true
    }

    return false
  }

  const hasKeyLike = <K extends PropertyKey>(
    obj: unknown,
    key: K,
  ): obj is Record<K, unknown> | ((...args: unknown[]) => unknown) => {
    if (!isObjectLike(obj)) {
      return false
    }

    return key in (obj as Record<K, unknown>)
  }

  const getRouterStack = (appObj: unknown): unknown[] => {
    if (!hasKeyLike(appObj, '_router')) {
      return []
    }

    const router = (appObj as Record<string, unknown>)._router
    if (!isObjectLike(router)) {
      return []
    }

    const stack = (router as RouterStackLike).stack
    if (!Array.isArray(stack)) {
      return []
    }

    return stack
  }

  const isMethodsMap = (value: unknown): value is MethodsMap => {
    if (!isObjectLike(value)) {
      return false
    }

    const record = value as Record<string, unknown>
    return Object.values(record).every(v => typeof v === 'boolean')
  }

  const isExpressRoute = (value: unknown): value is ExpressRoute => {
    if (!isObjectLike(value)) {
      return false
    }

    if (!hasKeyLike(value, 'methods')) {
      return false
    }

    const methods = (value as Record<string, unknown>).methods
    return isMethodsMap(methods)
  }

  const getNestedStack = (handle: unknown): unknown[] => {
    if (!hasKeyLike(handle, 'stack')) {
      return []
    }

    const stack = (handle as RouterStackLike).stack
    if (!Array.isArray(stack)) {
      return []
    }

    return stack
  }

  // helper: get a direct route from a layer, if present
  const getRouteFromLayer = (layer: unknown): ExpressRoute | null => {
    if (!hasKeyLike(layer, 'route')) {
      return null
    }

    const routeCandidate = (layer as Record<string, unknown>).route
    if (!isExpressRoute(routeCandidate)) {
      return null
    }

    return routeCandidate
  }

  // helper: get routes from a nested router handle on the layer
  const getNestedRoutesFromLayer = (layer: unknown): ExpressRoute[] => {
    if (!hasKeyLike(layer, 'handle')) {
      return []
    }

    const nestedStack = getNestedStack((layer as Record<string, unknown>).handle)
    if (!nestedStack.length) {
      return []
    }

    const routes: ExpressRoute[] = []

    for (const nestedLayer of nestedStack) {
      const nestedRoute = getRouteFromLayer(nestedLayer)
      if (nestedRoute) {
        routes.push(nestedRoute)
      }
    }

    return routes
  }

  const flattenRoutesFromStack = (stack: unknown[]): ExpressRoute[] => {
    const routes: ExpressRoute[] = []

    for (const layer of stack) {
      const directRoute = getRouteFromLayer(layer)
      if (directRoute) {
        routes.push(directRoute)
      }

      const nestedRoutes = getNestedRoutesFromLayer(layer)
      for (const nestedRoute of nestedRoutes) {
        routes.push(nestedRoute)
      }
    }

    return routes
  }

  const methodsToString = (methods: MethodsMap): string => {
    const order: HTTPMethods[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

    return order
      .map(method =>
        methods[method.toLowerCase() as Lowercase<HTTPMethods>] ? method : null,
      )
      .filter((method): method is HTTPMethods => method !== null)
      .join(',')
  }

  app.get('/api/backend/_debug/routes', (_req: Request, res: Response) => {
    const stack = getRouterStack(app)
    const flat = flattenRoutesFromStack(stack).map(route => ({
      methods: methodsToString(route.methods),
      path: route.path ?? '',
    }))

    res.json(flat)
  })
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Backend server is running' })
})

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler (must be last)
app.use(errorHandler)

export default app
