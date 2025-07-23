import express from "express";
import { loginHandler, logoutHandler, getProfile, getSession } from "../controllers/authController";
import { verifyToken } from "../middleware/authMiddleware";

const router = express.Router();

// Route definitions — no logic here
router.post("/login", loginHandler);
router.post("/logout", logoutHandler);
router.get("/session", verifyToken, getSession);
router.get("/me", verifyToken, getProfile);

export default router;
