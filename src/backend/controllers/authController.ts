import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { poolPromise, sql } from "../config/db";
import { getUserPermissions } from "../database/permissionQueries";
import { JwtPayload as CustomJwtPayload } from "@/types/JwtPayload";

const JWT_SECRET = process.env.JWT_SECRET!;

// ✅ POST /login
export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("Email", sql.VarChar, email)
      .query(`
        SELECT 
          u.UserID, u.FirstName, u.LastName, u.Email, u.PasswordHash,
          u.RoleID, u.ProfilePic, r.RoleName
        FROM Users u
        JOIN Roles r ON r.RoleID = u.RoleID
        WHERE u.Email = @Email
      `);

    const user = result.recordset[0];

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!passwordMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const permissions = await getUserPermissions(user.UserID);

    const tokenPayload: CustomJwtPayload = {
      userId: user.UserID,
      roleId: user.RoleID,
      role: user.RoleName,
      email: user.Email,
      name: `${user.FirstName} ${user.LastName}`,
      profilePic: user.ProfilePic,
      permissions,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "60m",
    });
    //console.log("✅ JWT Payload:", tokenPayload);

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 1000 * 60 * 60, // 60 minutes
      })
      .status(200)
      .json({
        user: tokenPayload,
        message: "Login successful",
      });

    //console.log("✅ Backend JWT_SECRET:", process.env.JWT_SECRET);
    //console.log("✅ Signed token:", token);

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ POST /logout
export const logoutHandler = (req: Request, res: Response): void => {
  res.clearCookie("token", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(200).json({ message: "Logout successful" });
};

// ✅ GET /session using verifyToken middleware
export const getSession = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "No session" });
    return;
  }

  const user = req.user as CustomJwtPayload;

  res.status(200).json({
    userId: user.userId,
    roleId: user.roleId,
    role: user.role,
    name: user.name ?? "",
    email: user.email ?? "",
    profilePic: user.profilePic ?? "",
    permissions: user.permissions ?? [],
  });
};

// ✅ GET /me
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    res.status(200).json({ user: req.user });
  } catch (error) {
    console.error("❌ Error in getProfile:", error);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

