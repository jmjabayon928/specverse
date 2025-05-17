// src/utils/permissionUtils.ts

/**
 * Mocked current user.
 * ✅ In production you should replace this with your real auth session:
 * Example: get currentUser from context, Redux, JWT, or database.
 */
const currentUser = {
  userId: 1,
  roles: ["admin", "warehouse"],      // example roles
  permissions: [
    "INVENTORY_VIEW",
    "INVENTORY_CREATE",
    "INVENTORY_EDIT",
    "INVENTORY_DELETE",
    "INVENTORY_TRANSACTION_CREATE",
    "INVENTORY_MAINTENANCE_VIEW",
    "INVENTORY_MAINTENANCE_CREATE",
    "DATASHEET_VIEW",
    "DATASHEET_EDIT",
    "TEMPLATE_VIEW",
    "TEMPLATE_EDIT"
  ],
};

/**
 * ✅ Check if current user has required permission
 */
export function checkUserPermission(requiredPermission: string) {
  return currentUser.permissions.includes(requiredPermission);
}

/**
 * ✅ Check if current user has any of the provided roles
 */
export function checkUserRole(allowedRoles: string[]) {
  return currentUser.roles.some((role) => allowedRoles.includes(role));
}

/**
 * ✅ Get current user (mock)
 * Replace with your actual user context later
 */
export function getCurrentUser() {
  return currentUser;
}
