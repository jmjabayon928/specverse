// src/backend/database/notificationQueries.ts
import { poolPromise, sql } from '../config/db';

export async function getNotificationsByUserId(userId: number) {
  const pool = await poolPromise;
  const request = pool.request();

  const result = await request
    .input('UserID', sql.Int, userId)
    .query(`
      SELECT 
        N.NotificationID,
        N.RelatedEntityID AS SheetID,
        COALESCE( S_Template.SheetName, S_Filled.SheetName, E.Title, S_Inventory.SheetName ) AS SheetName,
        N.Title,
        N.Message,
        N.Link,
        N.EntityType AS Category,
        N.CreatedAt,
        NR.IsRead,
        U.FirstName + ' ' + U.LastName AS SenderName,
        U.ProfilePic AS SenderProfilePic
      FROM Notifications N
      JOIN NotificationRecipients NR ON N.NotificationID = NR.NotificationID
      LEFT JOIN Users U ON N.CreatedBy = U.UserID
      LEFT JOIN Sheets S_Template ON N.RelatedEntityID = S_Template.SheetID AND N.EntityType = 'Template'
      LEFT JOIN Sheets S_Filled ON N.RelatedEntityID = S_Filled.SheetID AND N.EntityType = 'Datasheet'
      LEFT JOIN Estimations E ON N.RelatedEntityID = E.EstimationID AND N.EntityType = 'Estimation'
      LEFT JOIN Inventory I ON N.RelatedEntityID = I.InventoryID AND N.EntityType = 'Inventory'
      LEFT JOIN Sheets S_Inventory ON I.SheetID = S_Inventory.SheetID AND N.EntityType = 'Inventory'
      WHERE NR.UserID = @UserID AND nr.IsRead = 0
      ORDER BY N.CreatedAt DESC
    `);

  return result.recordset;
}
