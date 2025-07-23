import { Request } from "express";

export interface RequestWithUser extends Request {
  user?: {
    userId: number;
    role: string;
    email?: string;
    name?: string;
    profilePic?: string;
    permissions: string[];
  };
}
