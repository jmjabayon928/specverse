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
    status === "Rejected" &&
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
        <IconTooltip label="Duplicate Template">
          <button
            onClick={() =>
              router.push(`/datasheets/templates/create?cloneId=${sheet.sheetId}`)
            }
            title="Duplicate Template"
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
