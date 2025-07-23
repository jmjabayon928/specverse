// src/backend/utils/notifyUsers.ts

import { poolPromise, sql } from "@/backend/config/db";

interface NotifyUsersParams {
  recipientRoleIds?: number[];         // Optional: RoleIDs to notify
  recipientUserIds?: number[];         // ✅ Optional: direct user notifications
  sheetId: number;                     // Primary ID (SheetID, EstimationID, etc.)
  title: string;                       // Notification Title
  message: string;                     // Notification Message
  category: "Template" | "Datasheet" | "Estimation" | "Inventory" | "System";
  createdBy: number;                   // UserID who triggered the action
  linkOverride?: string;               // Optional: custom link
}

export async function notifyUsers({
  recipientRoleIds = [],
  recipientUserIds = [],
  sheetId,
  title,
  message,
  category,
  createdBy,
  linkOverride,
}: NotifyUsersParams) {
  const pool = await poolPromise;

  // 🔹 Step 1: Generate link
  let link = linkOverride || "/";
  switch (category) {
    case "Template":
      link = `/datasheets/templates/${sheetId}`;
      break;
    case "Datasheet":
      link = `/datasheets/filled/${sheetId}`;
      break;
    case "Estimation":
      link = `/estimation/${sheetId}`;
      break;
    case "Inventory":
      link = `/inventory/${sheetId}`;
      break;
    case "System":
      link = `/admin/system`;
      break;
  }

  // 🔹 Step 2: Get users by role
  const roleUserIds: number[] = [];
  if (recipientRoleIds.length > 0) {
    const roleQuery = await pool
      .request()
      .input("roleIds", sql.VarChar, recipientRoleIds.join(","))
      .query(`
        SELECT DISTINCT UserID
        FROM Users
        WHERE RoleID IN (SELECT value FROM STRING_SPLIT(@roleIds, ','))
      `);
    roleUserIds.push(...roleQuery.recordset.map((row) => row.UserID));
  }

  // 🔹 Step 3: Combine and deduplicate recipients
  const allRecipients = Array.from(new Set([...roleUserIds, ...recipientUserIds]));

  if (allRecipients.length === 0) return;

  // 🔹 Step 4: Insert into Notifications table
  const notifInsertResult = await pool
    .request()
    .input("Title", sql.NVarChar, title)
    .input("Message", sql.NVarChar, message)
    .input("Link", sql.NVarChar, link)
    .input("NotificationType", sql.NVarChar, category)
    .input("RelatedEntityID", sql.Int, sheetId)
    .input("EntityType", sql.NVarChar, category)
    .input("CreatedBy", sql.Int, createdBy)
    .input("CreatedAt", sql.DateTime, new Date())
    .query(`
      INSERT INTO Notifications (Title, Message, Link, NotificationType, RelatedEntityID, EntityType, CreatedBy, CreatedAt)
      OUTPUT INSERTED.NotificationID AS NotificationID
      VALUES (@Title, @Message, @Link, @NotificationType, @RelatedEntityID, @EntityType, @CreatedBy, @CreatedAt)
    `);

  const notificationId = notifInsertResult.recordset[0].NotificationID;

  // 🔹 Step 5: Insert recipient entries
  for (const userId of allRecipients) {
    await pool
      .request()
      .input("NotificationID", sql.Int, notificationId)
      .input("UserID", sql.Int, userId)
      .input("IsRead", sql.Bit, 0)
      .query(`
        INSERT INTO NotificationRecipients (NotificationID, UserID, IsRead)
        VALUES (@NotificationID, @UserID, @IsRead)
      `);
  }
}
