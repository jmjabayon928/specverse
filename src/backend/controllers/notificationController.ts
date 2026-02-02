// src/backend/controllers/notificationController.ts
import { Request, Response } from 'express';
import { getNotificationsByUserId } from '../database/notificationQueries';

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || typeof req.user.userId !== "number") {
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
  try {
    if (!req.user || !req.user.userId) {
      res.status(400).json({ error: "Invalid session" });
      return;
    }

    const userId = req.user.userId;
    const notifications = await getNotificationsByUserId(userId);
    res.status(200).json(notifications);
  } catch (err) {
    console.error("❌ Error in getNotificationsHandler:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};