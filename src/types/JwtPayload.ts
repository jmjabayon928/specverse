// types/JwtPayload.ts
import { JwtPayload as DefaultJwtPayload } from "jsonwebtoken";

export interface JwtPayload extends DefaultJwtPayload {
  userId: number;
  roleId: number;
  role: string;
  email?: string;
  name?: string;
  profilePic?: string;
  permissions?: string[];
}
