// src/backend/app.ts
import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

// Import routes
import userRoutes from "./routes/userRoutes";
import clientsRoutes from "./routes/clientsRoutes";
import categoriesRoutes from "./routes/categoriesRoutes";
import datasheetsRoutes from "./routes/datasheetRoutes";
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

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/backend/clients", clientsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/backend/datasheets", datasheetsRoutes); 
app.use("/api/backend/inventory", inventoryRoutes); 
app.use("/api/backend/estimation", estimationRoutes);
app.use("/api/backend/templates", templateRoutes);
app.use("/api/backend/filledsheets", filledSheetRoutes);
app.use("/api/backend/projects", projectsRoutes);
app.use("/api/languages", languageRoutes);
app.use("/api/backend/auth", authRoutes);
app.use("/api", labelRoutes); 
app.use("/api/backend", permissionRoutes);
app.use("/api/backend/notifications", notificationRoutes);
app.use("/api/backend", referenceRoutes);
app.use("/api/backend/stats", statsRoutes);
app.use("/api/backend/reports", reportsRoutes);

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Backend server is running" });
});

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
