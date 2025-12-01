// src/app/(admin)/datasheets/layouts/page.tsx
import type { Metadata } from "next";
import LayoutsIndexClient from "./LayoutsIndexClient";

export const metadata: Metadata = {
  title: "Datasheet Layouts",
};

export default async function LayoutsIndexPage() {
  // Client handles fetching (to enable create/delete without a full reload)
  return (
    <div className="container max-w-7xl py-6">
      <h1 className="text-2xl font-semibold mb-4">Datasheet Layouts</h1>
      <p className="text-sm text-gray-600 mb-6">
        Manage printable layouts per template (and optionally per client).
      </p>
      <LayoutsIndexClient />
    </div>
  );
}
