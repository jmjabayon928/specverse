"use client";

import React from "react";
import Link from "next/link";
import type { DemoModule } from "@/config/demoGuide";
import { demoGuide } from "@/config/demoGuide";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  module: DemoModule;
};

export default function PageContextBanner({ module }: Props) {
  const banner = demoGuide.pageBanners[module];
  if (!banner) return null;

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {banner.title}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {banner.body}
        </p>
        {banner.action && (
          <Link
            href={banner.action.href}
            className="mt-3 inline-block rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {banner.action.label}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
