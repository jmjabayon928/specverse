// components/inventory/InventoryTabLink.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface InventoryTabLinkProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

export default function InventoryTabLink({ href, label, icon }: InventoryTabLinkProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");

  const urlTab = href.includes("?tab=") ? href.split("?tab=")[1] : "";
  const isActive = activeTab === urlTab || (activeTab === null && urlTab === "overview");

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all duration-150 ${
        isActive
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-blue-600"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
