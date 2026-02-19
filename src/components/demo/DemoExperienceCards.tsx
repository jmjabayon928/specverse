"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DemoAudience } from "@/config/demoGuide";
import { demoGuide } from "@/config/demoGuide";
import { Card, CardContent } from "@/components/ui/card";

export default function DemoExperienceCards() {
  const [audience, setAudience] = useState<DemoAudience>(demoGuide.defaultAudience);
  const cards = demoGuide.experienceCards;

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="demo-audience" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Audience:
        </label>
        <select
          id="demo-audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value as DemoAudience)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="investor">Investor</option>
          <option value="recruiter">Recruiter</option>
          <option value="epcClient">EPC Client</option>
          <option value="engineeringManager">Engineering Manager</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const copy = card.copyByAudience[audience];
          const primaryLink = card.links.find((l) => l.kind === "primary");
          const secondaryLinks = card.links.filter((l) => l.kind !== "primary");

          return (
            <Card key={card.id}>
              <CardContent className="pt-6">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {copy.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {copy.oneLiner}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-gray-600 dark:text-gray-300">
                  {copy.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2">
                  {primaryLink && (
                    <Link
                      href={primaryLink.href}
                      className="inline-block rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {copy.ctaLabel}
                    </Link>
                  )}
                  {secondaryLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {secondaryLinks.map((link, i) => (
                        <Link
                          key={i}
                          href={link.href}
                          className="text-sm text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
