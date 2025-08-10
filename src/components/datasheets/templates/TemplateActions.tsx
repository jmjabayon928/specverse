// src/components/datasheets/templates/TemplateActions.tsx
"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/types/session";
import type { MinimalSheetForActions } from "@/types/sheet";
import IconTooltip from "@/components/ui/tooltip/IconTooltip";
import ExportSheetButtons from "@/components/datasheets/ExportSheetButtons";

interface TemplateActionsProps {
  sheet: MinimalSheetForActions;
  user: UserSession;
  unitSystem: "SI" | "USC";
  language: string;
  clientName: string;
  sheetName: string;
  revisionNum: number;
}

export default function TemplateActions({
  sheet,
  user,
  unitSystem,
  language,
  clientName,
  sheetName,
  revisionNum,
}: TemplateActionsProps) {
  // 🔹 All hooks first
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = React.useState<"dup" | "rev" | null>(null);

  // 🔹 Then guards (returns after hooks are fine)
  if (!user || !user.permissions) return null;
  if (!sheet || !sheet.status || !sheet.sheetId) return null;

  const status = sheet.status;
  const isCreator = user?.userId && sheet.preparedBy === user.userId;
  const isDetailPage =
    pathname.includes("/datasheets/templates/") && !pathname.includes("/create");

  const iconSize = isDetailPage ? 32 : 20;
  const gap = isDetailPage ? "gap-4" : "gap-2";

  // Keep existing rules
  const canEdit =
    isCreator && status === "Rejected" && user.permissions.includes("TEMPLATE_EDIT");

  const canVerify =
    user.permissions.includes("TEMPLATE_VERIFY") &&
    (status === "Draft" || status === "Modified Draft");

  const canApprove =
    user.permissions.includes("TEMPLATE_APPROVE") && status === "Verified";

  // Duplicate: any status if permitted
  const canDuplicate = user.permissions.includes("TEMPLATE_CREATE");

  // Create Revision: only from Verified/Approved
  const canCreateRevision =
    (status === "Verified" || status === "Approved") &&
    user.permissions.includes("TEMPLATE_REVISE");

  // Export rule unchanged
  const canExport =
    user.permissions.includes("TEMPLATE_EXPORT") && status === "Approved";

  async function postAndGo(action: "duplicate" | "revisions") {
    try {
      setBusy(action === "duplicate" ? "dup" : "rev");

      const clone = window.confirm(
        "Clone physical files instead of linking existing attachments?\nOK = Clone, Cancel = Link"
      );

      const res = await fetch(
        `/api/backend/templates/${sheet.sheetId}/${action}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ linkPolicy: clone ? "clone" : "link" }),
        }
      );

      if (!res.ok) {
        const msg = await safeErr(res);
        throw new Error(msg);
      }

      const data = await res.json();
      const newId: number =
        typeof data.newSheetId === "number"
          ? data.newSheetId
          : typeof data.sheetId === "number"
          ? data.sheetId
          : 0;

      if (!newId) throw new Error("No new sheet id returned.");
      router.push(`/datasheets/templates/${newId}`);
    } catch (err) {
      console.error("Template action failed:", err);
      alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {canEdit && (
        <IconTooltip label="Edit Template">
          <button
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/edit`)}
            title="Edit Template"
          >
            <Image src="/images/edit.png" alt="Edit" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canVerify && (
        <IconTooltip label="Verify or Reject">
          <button
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/verify`)}
            title="Verify or Reject Template"
          >
            <Image src="/images/verify.png" alt="Verify" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canApprove && (
        <IconTooltip label="Approve Template">
          <button
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/approve`)}
            title="Approve Template"
          >
            <Image src="/images/approve.png" alt="Approve" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canDuplicate && (
        <IconTooltip label="Duplicate Template">
          <button
            onClick={() => postAndGo("duplicate")}
            title="Duplicate Template"
            disabled={busy !== null}
          >
            <Image
              src="/images/duplicate.png"
              alt="Duplicate"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canCreateRevision && (
        <IconTooltip label="Create Revision">
          <button
            onClick={() => postAndGo("revisions")}
            title="Create Revision"
            disabled={busy !== null}
          >
            <Image
              src="/images/revision3.png"
              alt="Revision"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canExport && (
        <ExportSheetButtons
          sheetId={sheet.sheetId}
          sheetName={sheetName}
          revisionNum={revisionNum}
          unitSystem={unitSystem}
          language={language}
          isTemplate={true}
          clientName={clientName}
          iconSize={iconSize}
        />
      )}
    </div>
  );
}

async function safeErr(res: Response): Promise<string> {
  try {
    const t = await res.text();
    if (!t) return `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(t) as { error?: string; message?: string };
      return j.error || j.message || t;
    } catch {
      return t;
    }
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
