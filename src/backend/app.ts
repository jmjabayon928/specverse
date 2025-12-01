// src/backend/app.ts
import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

// Import routes
import usersRoutes from "./routes/usersRoutes";
import rolesRoutes from "./routes/rolesRoutes";
import permissionsRoutes from "./routes/permissionsRoutes";
import clientsRoutes from "./routes/clientsRoutes";
import manufacturersRoutes from "./routes/manufacturersRoutes";
import suppliersRoutes from "./routes/suppliersRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import datasheetsRoutes from "./routes/datasheetRoutes";
import layoutRoutes from "./routes/layoutRoutes";
import mirrorRoutes from './routes/mirrorRoutes';
import languageRoutes from "./routes/languageRoutes";
import labelRoutes from "./routes/labelRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import estimationRoutes from "./routes/estimationRoutes";
import templateRoutes from "./routes/templateRoutes";
import filledSheetRoutes from "./routes/filledSheetRoutes";
import projectsRoutes from "./routes/projectsRoutes";
import authRoutes from "./routes/authRoutes";
import permissionRoutes from "./routes/permissionRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import referenceRoutes from "@/backend/routes/referenceRoutes";
import statsRoutes from "./routes/statsRoutes";
import reportsRoutes from "./routes/reportsRoutes";
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();
app.use(express.json({ limit: '10mb' }));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// Routes
app.use("/api/backend/settings/users", usersRoutes);
app.use("/api/backend/settings/roles", rolesRoutes);
app.use("/api/backend/settings/permissions", permissionsRoutes);
app.use("/api/backend/settings/projects", projectsRoutes);
app.use("/api/backend/settings/clients", clientsRoutes);
app.use("/api/backend/settings/manufacturers", manufacturersRoutes);
app.use("/api/backend/settings/suppliers", suppliersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/backend/datasheets", datasheetsRoutes);
app.use("/api/backend/layouts", layoutRoutes);
app.use("/api/backend/inventory", inventoryRoutes);
app.use("/api/backend/estimation", estimationRoutes);
app.use("/api/backend/templates", templateRoutes);
app.use("/api/backend/filledsheets", filledSheetRoutes);
app.use("/api/backend/projects", projectsRoutes);
app.use("/api/languages", languageRoutes);
app.use("/api/backend/auth", authRoutes);
app.use("/api", labelRoutes);
app.use('/api/mirror', mirrorRoutes);
app.use("/api/backend", permissionRoutes);
app.use("/api/backend/notifications", notificationRoutes);
app.use("/api/backend", referenceRoutes);
app.use("/api/backend/stats", statsRoutes);
app.use("/api/backend/reports", reportsRoutes);
app.use(errorHandler);

// ──────────────────────────────────────────────────────────────
// DEV ONLY: routes inspector (no `any`, supports function handles)
// Visit: http://localhost:5000/api/backend/_debug/routes
// ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  type HTTPMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  type MethodsMap = Partial<Record<Lowercase<HTTPMethods>, boolean>>;

  interface ExpressRoute {
    path?: string;
    methods: MethodsMap;
  }

  interface RouterStackLike {
    stack?: unknown[];
  }

  // Accepts objects *and* functions (Express router "handle" is a function with .stack)
  function isObjectLike(x: unknown): x is Record<string, unknown> | ((...args: unknown[]) => unknown) {
    return (typeof x === "object" && x !== null) || typeof x === "function";
  }

  function hasKeyLike<K extends PropertyKey>(
    obj: unknown,
    key: K
  ): obj is Record<K, unknown> | ((...args: unknown[]) => unknown) {
    return isObjectLike(obj) && key in (obj as Record<K, unknown>);
  }

  function getRouterStack(appObj: unknown): unknown[] {
    if (!hasKeyLike(appObj, "_router")) return [];
    const router = (appObj as Record<string, unknown>)["_router"];
    if (!isObjectLike(router)) return [];
    const stack = (router as RouterStackLike).stack;
    return Array.isArray(stack) ? stack : [];
  }

  function isMethodsMap(x: unknown): x is MethodsMap {
    if (!isObjectLike(x)) return false;
    return Object.values(x as Record<string, unknown>).every((v) => typeof v === "boolean");
  }

  function isExpressRoute(x: unknown): x is ExpressRoute {
    if (!isObjectLike(x)) return false;
    if (!hasKeyLike(x, "methods")) return false;
    return isMethodsMap((x as Record<string, unknown>)["methods"]);
  }

  function getNestedStack(handle: unknown): unknown[] {
    if (!hasKeyLike(handle, "stack")) return [];
    const stack = (handle as RouterStackLike).stack;
    return Array.isArray(stack) ? stack : [];
  }

  function flattenRoutesFromStack(stack: unknown[]): ExpressRoute[] {
    const routes: ExpressRoute[] = [];
    for (const layer of stack) {
      // Direct route on a layer
      if (hasKeyLike(layer, "route") && isExpressRoute((layer as Record<string, unknown>)["route"])) {
        routes.push((layer as Record<string, unknown>)["route"] as ExpressRoute);
      }
      // Nested router layers (layer.handle is a function with .stack)
      const nested = hasKeyLike(layer, "handle") ? getNestedStack((layer as Record<string, unknown>)["handle"]) : [];
      for (const nl of nested) {
        if (hasKeyLike(nl, "route") && isExpressRoute((nl as Record<string, unknown>)["route"])) {
          routes.push((nl as Record<string, unknown>)["route"] as ExpressRoute);
        }
      }
    }
    return routes;
  }

  function methodsToString(methods: MethodsMap): string {
    const order: HTTPMethods[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    return order
      .map((m) => (methods[m.toLowerCase() as Lowercase<HTTPMethods>] ? m : null))
      .filter((m): m is HTTPMethods => m !== null)
      .join(",");
  }

  app.get("/api/backend/_debug/routes", (_req: Request, res: Response) => {
    const stack = getRouterStack(app);
    const flat = flattenRoutesFromStack(stack).map((r) => ({
      methods: methodsToString(r.methods),
      path: r.path ?? "",
    }));
    res.json(flat);
  });
}

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Backend server is running" });
});

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
