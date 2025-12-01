// Original frontend shape (used in UI, dropdown, etc.)
export type UINotification = {
  id: number;
  category: "Datasheet" | "Estimation" | "Inventory";
  message: string;
  url: string;
  createdAt: string;
  isRead: boolean;
  triggeredBy: {
    name: string;
    profilePic: string;
  };
};

// Raw shape from the database
export interface RawNotification {
  NotificationID: number;
  SheetID: number | null;
  SheetName: string | null;
  Title: string;
  Message: string;
  Link: string | null;
  Category: string;
  CreatedAt: string;
  IsRead: boolean;
  SenderName?: string;
  SenderProfilePic?: string;
}

// Processed shape for frontend consumption
export interface Notification {
  notificationId: number;
  sheetId: number | null;
  sheetName: string | null;
  title: string;
  message: string;
  link: string | null;
  category: string;
  createdAt: string;
  isRead: boolean;
  senderName?: string;
  senderProfilePic?: string;
}
