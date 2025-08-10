// src/components/datasheets/filled/FilledSheetActions.tsx
"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/types/session";
import type { MinimalSheetForActions } from "@/types/sheet";
import IconTooltip from "@/components/ui/tooltip/IconTooltip";
import ExportSheetButtons from "@/components/datasheets/ExportSheetButtons";

interface FilledSheetActionsProps {
  sheet: MinimalSheetForActions;
  user: UserSession;
  unitSystem: "SI" | "USC";
  language: string;
  clientName: string;
  sheetName: string;
  revisionNum: number;
}

export default function FilledSheetActions({
  sheet,
  user,
  unitSystem,
  language,
  clientName,
  sheetName,
  revisionNum,
}: FilledSheetActionsProps) {
  // All hooks must come before any early returns
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = React.useState<"dup" | "rev" | null>(null);

  // Guard: missing session/permissions
  if (!user || !user.permissions) {
    return null; // optionally show a small "please re-login" state
  }

  const status = sheet.status;
  const isCreator = user?.userId && sheet.preparedBy === user.userId;
  const isDetailPage =
    pathname.includes("/datasheets/filled/") && !pathname.includes("/create");

  const iconSize = isDetailPage ? 32 : 20;
  const gap = isDetailPage ? "gap-4" : "gap-2";

  // Existing rules (unchanged)
  const canEdit =
    isCreator &&
    (status === "Draft" || status === "Modified Draft" || status === "Rejected") &&
    user.permissions.includes("DATASHEET_EDIT");

  const canVerify =
    user.permissions.includes("DATASHEET_VERIFY") &&
    (status === "Draft" || status === "Modified Draft");

  const canApprove =
    user.permissions.includes("DATASHEET_APPROVE") && status === "Verified";

  // Updated rules per our policy:
  // Duplicate = allowed from ANY status if user has create permission
  const canDuplicate = user.permissions.includes("DATASHEET_CREATE");

  // Create Revision = only from Verified/Approved + revise permission
  const canCreateRevision =
    (status === "Verified" || status === "Approved") &&
    user.permissions.includes("DATASHEET_REVISE");

  // Keep export rule: only from Approved
  const canExport =
    user.permissions.includes("DATASHEET_EXPORT") && status === "Approved";

  async function postAndGo(action: "duplicate" | "revisions") {
    try {
      setBusy(action === "duplicate" ? "dup" : "rev");

      // Let user choose link vs clone for attachments
      const clone = window.confirm(
        "Clone physical files instead of linking existing attachments?\nOK = Clone, Cancel = Link"
      );

      const res = await fetch(
        `/api/backend/filledsheets/${sheet.sheetId}/${action}`,
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
      router.push(`/datasheets/filled/${newId}`);
    } catch (err) {
      console.error("Filled sheet action failed:", err);
      alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {canEdit && (
        <IconTooltip label="Edit Filled Sheet">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/edit`)}
            title="Edit Filled Sheet"
          >
            <Image src="/images/edit.png" alt="Edit" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canVerify && (
        <IconTooltip label="Verify or Reject">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/verify`)}
            title="Verify or Reject Filled Sheet"
          >
            <Image src="/images/verify.png" alt="Verify" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canApprove && (
        <IconTooltip label="Approve Filled Sheet">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/approve`)}
            title="Approve Filled Sheet"
          >
            <Image src="/images/approve.png" alt="Approve" width={iconSize} height={iconSize} />
          </button>
        </IconTooltip>
      )}

      {canDuplicate && (
        <IconTooltip label="Duplicate Filled Sheet">
          <button
            onClick={() => postAndGo("duplicate")}
            title="Duplicate Filled Sheet"
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
          isTemplate={false}
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
