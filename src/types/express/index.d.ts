import "express";

declare module "express" {
  interface User {
    userId: number;
    roles: string[];
    permissions: string[];
  }

  interface Request {
    user?: User;
  }
}
