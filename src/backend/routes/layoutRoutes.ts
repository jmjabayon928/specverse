import { Router } from "express";
import * as LayoutController from "@/backend/controllers/layoutController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

// Collection under mount "/api/backend/layouts"
router.get("/", verifyToken, LayoutController.listLayouts);
router.post("/", verifyToken, LayoutController.createLayout);

// Subsheet-scoped (no layoutId in path) 
router.get("/subsheets/:subId/infotemplates", verifyToken, LayoutController.getSubsheetInfoTemplates);

// Layout-scoped (MOST specific first; all paths are RELATIVE to "/api/backend/layouts")
router.get("/:layoutId/structure", verifyToken, LayoutController.getLayoutStructure);
router.get("/:layoutId/bodyslots", verifyToken, LayoutController.getLayoutBodySlots);
router.post("/:layoutId/bodyslots", verifyToken, LayoutController.saveLayoutBodySlots);
router.get("/:layoutId/subsheets/:subId/slots", verifyToken, LayoutController.getSubsheetSlots);
router.put("/:layoutId/subsheets/:subId/slots", verifyToken, LayoutController.saveSubsheetSlots);

router.get("/:layoutId/render", verifyToken, LayoutController.renderLayout);

// Region/Block (literal prefixes stay BEFORE the catch-all ":layoutId")
router.post("/regions/:regionId/blocks", verifyToken, LayoutController.addBlock);
router.put("/blocks/:blockId", verifyToken, LayoutController.updateBlock);
router.post("/:layoutId/regions", verifyToken, LayoutController.addRegion);
router.put("/regions/:regionId", verifyToken, LayoutController.updateRegion);

// Layout single (least specific last)
router.get("/:layoutId", verifyToken, LayoutController.getLayout);
router.put("/:layoutId", verifyToken, LayoutController.updateLayoutMeta);

export default router;
