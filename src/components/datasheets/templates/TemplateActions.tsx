// src/components/datasheets/templates/TemplateActions.tsx
"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/domain/auth/sessionTypes";
import type { MinimalSheetForActions } from "@/domain/datasheets/sheetTypes";
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
  const router = useRouter();
  const pathname = usePathname();

  if (!user || !user.permissions) {
    return null;
  }

  if (!sheet || !sheet.status || !sheet.sheetId) {
    return null;
  }

  const status = sheet.status;
  const isCreator = user?.userId && sheet.preparedBy === user.userId;
  const isDetailPage =
    pathname.includes("/datasheets/templates/") &&
    !pathname.includes("/create");

  const iconSize = isDetailPage ? 32 : 20;
  const gap = isDetailPage ? "gap-4" : "gap-2";

  const canEdit =
    isCreator &&
    (status === "Draft" || status === "Modified Draft" || status === "Rejected") &&
    user?.permissions.includes("TEMPLATE_EDIT");

  const canVerify =
    user?.permissions.includes("TEMPLATE_VERIFY") &&
    (status === "Draft" || status === "Modified Draft");

  const canApprove =
    user?.permissions.includes("TEMPLATE_APPROVE") && status === "Verified";

  const canDuplicate =
    user?.permissions.includes("TEMPLATE_CREATE") && status === "Approved";

  const canExport =
    user?.permissions.includes("TEMPLATE_EXPORT") && status === "Approved";

  // NEW: Allow creating a FILLED sheet from an APPROVED template
  // Accept any of these permission names (adjust to match your auth):
  //  - "FILLED_CREATE" or "DATASHEET_CREATE" or "SHEET_CREATE"
  const canCreateFilled =
    status === "Approved" &&
    user.permissions.some((p) =>
      ["FILLED_CREATE", "DATASHEET_CREATE", "SHEET_CREATE"].includes(p)
    );

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {canEdit && (
        <IconTooltip label="Edit Template">
          <button
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/edit`)}
            title="Edit Template"
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
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/verify`)}
            title="Verify or Reject Template"
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
        <IconTooltip label="Approve Template">
          <button
            onClick={() => router.push(`/datasheets/templates/${sheet.sheetId}/approve`)}
            title="Approve Template"
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
        <IconTooltip label="Clone Template">
          <button
            onClick={() =>
              router.push(`/datasheets/templates/${sheet.sheetId}/clone`)
            }
            title="Clone Template"
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

      {/* NEW: Create Filled Sheet from this Approved template */}
      {canCreateFilled && (
        <IconTooltip label="Create Filled Sheet">
          <button
            onClick={() =>
              router.push(`/datasheets/filled/create?templateId=${sheet.sheetId}`)
            }
            title="Create Filled Sheet"
          >
            {/* Use an icon you have; update the path if needed */}
            <Image
              src="/images/fill-up.png"
              alt="Create Filled Sheet"
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
