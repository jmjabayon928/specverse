// components/inventory/InventoryTabLink.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface InventoryTabLinkProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledTooltip?: string;
  activeTabOverride?: string;
}

export default function InventoryTabLink({
  href,
  label,
  icon,
  disabled = false,
  disabledTooltip = "No access",
  activeTabOverride,
}: InventoryTabLinkProps) {
  const searchParams = useSearchParams();
  const urlActiveTab = searchParams.get("tab");
  const KNOWN_TABS = ["overview", "transactions", "audit", "maintenance"] as const;
  const safeOverride = activeTabOverride && KNOWN_TABS.includes(activeTabOverride as typeof KNOWN_TABS[number])
    ? activeTabOverride
    : undefined;
  const effectiveActive = safeOverride ?? urlActiveTab ?? "overview";

  const urlTab = href.includes("?tab=") ? href.split("?tab=")[1] : "";
  const isActive = effectiveActive === urlTab;

  const baseClass =
    "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-150";
  const activeClass = isActive
    ? "border-blue-600 text-blue-600"
    : "border-transparent text-gray-500 hover:text-blue-600";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  if (disabled) {
    return (
      <span
        title={disabledTooltip}
        className={`${baseClass} ${activeClass} ${disabledClass} border-transparent text-gray-400`}
        role="link"
        aria-disabled="true"
        tabIndex={0}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <Link href={href} className={`${baseClass} ${activeClass}`} role="tab">
      {icon}
      {label}
    </Link>
  );
}
