// src/components/datasheets/filled/FilledSheetActions.tsx
"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/domain/auth/sessionTypes";
import type { MinimalSheetForActions } from "@/domain/datasheets/sheetTypes";
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
  const router = useRouter();
  const pathname = usePathname();

  // ✅ Type guard to prevent crashing if session is missing
  if (!user || !user.permissions) {
    return null; // Optionally: show <p>Session expired. Please log in again.</p>
  }
  
  const status = sheet.status;
  const isCreator = user?.userId && sheet.preparedBy === user.userId;
  const isDetailPage =
    pathname.includes("/datasheets/filled/") &&
    !pathname.includes("/create");

  const iconSize = isDetailPage ? 32 : 20;
  const gap = isDetailPage ? "gap-4" : "gap-2";

  const canEdit =
    isCreator &&
    (status === "Draft" || status === "Modified Draft" || status === "Rejected") &&
    user?.permissions?.includes("DATASHEET_EDIT");

  const canVerify =
    user?.permissions?.includes("DATASHEET_VERIFY") &&
    (status === "Draft" || status === "Modified Draft");

  const canApprove =
    user?.permissions?.includes("DATASHEET_APPROVE") && status === "Verified";

  const canDuplicate =
    user?.permissions?.includes("DATASHEET_CREATE") && status === "Approved";

  const canExport =
    user?.permissions?.includes("DATASHEET_EXPORT") && status === "Approved";

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {canEdit && (
        <IconTooltip label="Edit Filled Sheet">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/edit`)}
            title="Edit Filled Sheet"
          >
            <Image
              src="/images/edit.png"
              alt="Edit"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canVerify && (
        <IconTooltip label="Verify or Reject">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/verify`)}
            title="Verify or Reject Filled Sheet"
          >
            <Image
              src="/images/verify.png"
              alt="Verify"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canApprove && (
        <IconTooltip label="Approve Filled Sheet">
          <button
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/approve`)}
            title="Approve Filled Sheet"
          >
            <Image
              src="/images/approve.png"
              alt="Approve"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canDuplicate && (
        <IconTooltip label="Clone Filled Sheet">
          <button
            onClick={() =>
              router.push(`/datasheets/filled/${sheet.sheetId}/clone`)
            }
            title="Clone Filled Sheet"
          >
            <Image
              src="/images/duplicate.png"
              alt="Clone"
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
