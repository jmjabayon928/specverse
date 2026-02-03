// src/utils/auditEntityLink.ts
// Central mapping from audit log entityType/entityId (and optional action) to a UI link.
// Used by the Audit Logs page to offer "View entity" links. Unknown types are not linked.
//
// Audit log source: TableName is always "Sheets" for both templates and filled sheets;
// distinction comes only from Action. Actions are from templateService, filledSheetService,
// and auditMiddleware (templateRoutes, filledSheetRoutes).

export interface AuditEntityLink {
  href: string;
  label: string;
}

/**
 * Known audit action strings that refer to a template (Sheet with IsTemplate=1).
 * Sourced from: templateService (Create/Verify/Approve/Reject), templateRoutes (auditAction middleware).
 * Default to 'filled' for any action not in this set (safer for demos).
 */
const TEMPLATE_ACTIONS = new Set<string>([
  "Create Template",
  "Update Template",
  "Clone Template",
  "Verify Template",
  "Reject Template",
  "Approve Template",
  "Create Template Note",
  "Update Template Note",
  "Delete Template Note",
  "Upload Template Attachment",
  "Delete Template Attachment",
  "Export Template PDF",
  "Export Template Excel",
]);

/**
 * Infers whether a Sheets audit row refers to a template or a filled sheet from the action string.
 * Uses an explicit allowlist of template actions; defaults to 'filled' when unsure.
 */
export function inferSheetKindFromAction(action: string | null | undefined): "template" | "filled" {
  const a = (action ?? "").trim();
  if (a === "") return "filled";
  return TEMPLATE_ACTIONS.has(a) ? "template" : "filled";
}

/**
 * Returns a link for the given audit log entity, or null if the type is unknown or id is missing.
 * - Sheets: template vs filled inferred via inferSheetKindFromAction(action).
 * - Users: link to settings users list (no per-user page in app).
 */
export function getAuditEntityLink(
  entityType: string | null,
  entityId: number | null,
  action?: string | null
): AuditEntityLink | null {
  if (entityId == null || !Number.isFinite(entityId) || entityId <= 0) {
    return null;
  }

  const type = (entityType ?? "").trim();

  if (type === "Sheets") {
    const kind = inferSheetKindFromAction(action);
    if (kind === "template") {
      return {
        href: `/datasheets/templates/${entityId}`,
        label: "View template",
      };
    }
    return {
      href: `/datasheets/filled/${entityId}`,
      label: "View filled sheet",
    };
  }

  if (type === "Users") {
    return {
      href: "/settings/users",
      label: "View users",
    };
  }

  return null;
}
