import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload as CustomJwtPayload } from "../../types/JwtPayload";
import { checkUserPermission } from "../database/permissionQueries";

const JWT_SECRET = process.env.JWT_SECRET!;

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies.token;

  if (!token) {
    console.warn("⛔ No token received");
    res.status(401).json({ message: "Unauthorized - No token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;

    if (!decoded.userId || !decoded.role) {
      console.warn("⛔ Token payload missing required fields");
      res.status(403).json({ message: "Invalid token payload" });
      return;
    }

    req.user = {
      userId: decoded.userId,
      roleId: decoded.roleId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
      profilePic: decoded.profilePic,
      permissions: decoded.permissions ?? [],
    };

    next();
  } catch (err) {
    console.error("❌ Token verification error:", err);
    res.status(403).json({ message: "Invalid or expired session" });
  }
};

export function requirePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(403).send("Missing user in request");
        return;
      }

      const hasPermission = await checkUserPermission(req.user.userId, permissionKey);
      if (!hasPermission) {
        res.status(403).send("Permission denied");
        return;
      }

      next();
    } catch (err) {
      console.error("Permission middleware error:", err);
      res.status(500).send("Server error");
    }
  };
}
