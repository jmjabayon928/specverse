// src/backend/routes/notificationRoutes.ts
import express, { Request, Response } from "express";
import { UserSession } from "@/types/session";
import { getNotificationsHandler } from "../controllers/notificationController";
import { verifyToken } from "../middleware/authMiddleware";
import { poolPromise, sql } from "../config/db";

const router = express.Router();

// ✅ Only ONE get route for notifications
router.get("/", verifyToken, getNotificationsHandler);

// ✅ PATCH to mark as read
router.patch("/:id/read", verifyToken, async (req: Request, res: Response): Promise<void> => {
  const notifId = Number(req.params.id);
  const userId = (req.user as UserSession)?.userId;

  console.log("📨 Marking notification as read:", notifId, "by user:", userId);

  if (!notifId || !userId) {
    res.status(400).json({ error: "Invalid notification ID or user session" });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("NotificationID", sql.Int, notifId)
      .input("UserID", sql.Int, userId)
      .query(`
        UPDATE NotificationRecipients
        SET IsRead = 1
        WHERE NotificationID = @NotificationID AND UserID = @UserID
      `);

    console.log("🔧 Rows affected:", result.rowsAffected);

    if (result.rowsAffected[0] === 0) {
      console.warn("⚠️ No matching notification recipient to update");
    }

    res.status(200).json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("❌ Failed to mark notification as read:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

router.get("/test", verifyToken, (req, res) => {
  res.status(200).json({ message: "✅ Token valid", user: req.user });
});

export default router;
