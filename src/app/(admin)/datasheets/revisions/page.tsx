// src/app/(admin)/datasheets/revisions/page.tsx
"use client";
import { useRouter } from "next/navigation";
import SecurePage from '@/components/security/SecurePage';

export default function RevisionBrowserPage() {
  const router = useRouter();

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Datasheet Revisions (Unavailable)</h1>

        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            This screen is temporarily disabled. It depends on legacy backend routes that are no longer part of the current platform.
            Revisions and version history will return in a future stabilization phase.
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => router.push("/datasheets/filled")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Filled Datasheets
            </button>
            <button
              onClick={() => router.push("/datasheets/templates")}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              View Templates
            </button>
          </div>
        </div>
      </div>
    </SecurePage>
  );
}
