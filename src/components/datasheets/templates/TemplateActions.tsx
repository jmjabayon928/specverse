// src/components/datasheets/templates/TemplateActions.tsx

"use client";

import React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/types/session";
import type { MinimalSheetForActions } from "@/types/sheet";
import IconTooltip from "@/components/ui/tooltip/IconTooltip";

interface TemplateActionsProps {
  template: MinimalSheetForActions;
  user: UserSession;
}

export default function TemplateActions({
  template,
  user,
}: TemplateActionsProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ Type guard to prevent crashing if session is missing
  if (!user || !user.permissions) {
    return null; // Optionally: show <p>Session expired. Please log in again.</p>
  }
  
  const status = template.status;
  const isCreator = template.preparedBy === user.userId;
  const isDetailPage = pathname.includes("/datasheets/templates/") && !pathname.includes("/create");

  const iconSize = isDetailPage ? 32 : 20;
  const gap = isDetailPage ? "gap-4" : "gap-2";

  const canEdit =
    isCreator &&
    (status === "Draft" || status === "Modified Draft" || status === "Rejected") &&
    user?.permissions?.includes("TEMPLATE_EDIT");

  const canVerify =
    user?.permissions?.includes("TEMPLATE_VERIFY") &&
    (status === "Draft" || status === "Modified Draft");

  const canApprove =
    user?.permissions?.includes("TEMPLATE_APPROVE") && status === "Verified";

  const canDuplicate =
    user?.permissions?.includes("TEMPLATE_CREATE") && status === "Approved";

  const canExport =
    user?.permissions?.includes("TEMPLATE_EXPORT") && status === "Approved";

  const canFill =
    user?.permissions?.includes("DATASHEET_CREATE") && status === "Approved";

  return (
    <div className={`flex flex-wrap items-center ${gap}`}>
      {canEdit && (
        <IconTooltip label="Edit Template">
          <button
            onClick={() => router.push(`/datasheets/templates/${template.sheetId}/edit`)}
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
            onClick={() => router.push(`/datasheets/templates/${template.sheetId}/verify`)}
            title="Verify Template"
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
            onClick={() => router.push(`/datasheets/templates/${template.sheetId}/approve`)}
            title="Approve Template"
          >
            <Image
              src="/images/verify.png"
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
              router.push(`/datasheets/templates/create?cloneId=${template.sheetId}`)
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
        <>
          <IconTooltip label="Export as PDF">
            <button
              onClick={() =>
                window.open(`/api/backend/templates/export/${template.sheetId}/pdf`, "_blank")
              }
              title="Export as PDF"
            >
              <Image
                src="/images/pdf.png"
                alt="Export PDF"
                width={iconSize}
                height={iconSize}
              />
            </button>
          </IconTooltip>
          <IconTooltip label="Export as Excel">
            <button
              onClick={() =>
                window.open(`/api/backend/templates/export/${template.sheetId}/excel`, "_blank")
              }
              title="Export as Excel"
            >
              <Image
                src="/images/xls.png"
                alt="Export Excel"
                width={iconSize}
                height={iconSize}
              />
            </button>
          </IconTooltip>
        </>
      )}

      {canFill && (
        <IconTooltip label="Create Filled Sheet">
          <button
            onClick={() =>
              router.push(`/datasheets/filled/create?templateId=${template.sheetId}`)
            }
            title="Create Filled Sheet"
          >
            <Image
              src="/images/fill-up.png"
              alt="Create Filled Sheet"
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}
    </div>
  );
}
