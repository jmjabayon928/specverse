import { Suspense } from "react";
import InventoryTransactionsClient from "./InventoryTransactionsClient";

export default function GlobalTransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <InventoryTransactionsClient />
    </Suspense>
  );
}
