// src/backend/controllers/notificationController.ts
import { Request, Response } from 'express';
import { getNotificationsByUserId } from '../database/notificationQueries';

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("📬 [getUserNotifications] Incoming req.user:", req.user);

    // This ensures userId is truly a number and present
    if (!req.user || typeof req.user.userId !== "number") {
      console.warn("⛔ Missing or invalid user in request");
      res.status(400).json({ error: "Invalid user in session" });
      return;
    }

    const userId = req.user.userId;

    const notifications = await getNotificationsByUserId(userId);
    res.status(200).json(notifications);
  } catch (error) {
    console.error("❌ Failed to fetch notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getNotificationsHandler = async (req: Request, res: Response): Promise<void> => {
  //console.log("📩 getNotificationsHandler called");
  try {
    if (!req.user || !req.user.userId) {
      console.warn("⛔ No user in session");
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    const userId = req.user.userId;
    //console.log("✅ Fetching notifications for UserID:", userId);

    const notifications = await getNotificationsByUserId(userId);
    res.status(200).json(notifications);
  } catch (err) {
    console.error("❌ Error in getNotificationsHandler:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};