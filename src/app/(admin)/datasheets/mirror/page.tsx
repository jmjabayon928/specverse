// src/app/(admin)/datasheets/mirror/page.tsx
"use client";

import Link from "next/link";
import React from "react";

export default function MirrorPage() {
  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Datasheet Mirror (Experimental)</h1>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 max-w-3xl">
          This screen is temporarily disabled. The Datasheet Mirror flow is an experimental
          feature and is not yet aligned with the platform&apos;s session-based authentication
          and security model.
        </p>
      </header>

      <section className="space-y-3 max-w-3xl">
        <p className="text-sm text-gray-700">
          Mirror will return in a future stabilization phase once it has:
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>Full alignment with cookie-based session auth (no localStorage tokens).</li>
          <li>Hardened upload and processing paths for Excel-based datasheets.</li>
          <li>Clear auditability and traceability for generated outputs.</li>
        </ul>
        <p className="text-sm text-gray-600">
          For now, please continue working from your existing templates and filled datasheets.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/datasheets/templates"
          className="inline-flex items-center px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Back to Templates
        </Link>
        <Link
          href="/datasheets/filled"
          className="inline-flex items-center px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Back to Filled Datasheets
        </Link>
      </section>
    </div>
  );
}

