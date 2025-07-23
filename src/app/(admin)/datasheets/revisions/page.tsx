"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SecurePage from '@/components/security/SecurePage';

type Sheet = {
  SheetID: number;
  SheetName: string;
  Status: string;
  RevisionNum: number;
  IsLatest: boolean;
  ParentSheetID: number | null;
};

export default function RevisionBrowserPage() {
  type StatusType = "All" | "Draft" | "Verified" | "Approved";
  const [parents, setParents] = useState<Sheet[]>([]);
  const [revisions, setRevisions] = useState<Record<number, Sheet[]>>({});
  const [filterStatus, setFilterStatus] = useState<StatusType>("All");
  const router = useRouter();

  useEffect(() => {
    async function fetchParents() {
      const res = await fetch("http://localhost:5000/api/datasheets/parents");
      const data = await res.json();
      console.log("✅ Fetched parents:", data); // 🧪 Add this for debugging
  
      if (Array.isArray(data)) {
        setParents(data);
      } else {
        console.warn("❌ Unexpected API response for parents:", data);
      }
    }
    fetchParents();
  }, []);

  useEffect(() => {
    async function fetchAllRevisions() {
      for (const parent of parents) {
        console.log("📦 ParentID being fetched:", parent.SheetID);
        if (!parent?.SheetID || isNaN(Number(parent.SheetID))) continue; // 👈 skip invalid entries
  
        try {
          const res = await fetch(`http://localhost:5000/api/datasheets/${parent.SheetID}/revisions`);
          const data = await res.json();
          setRevisions((prev) => ({ ...prev, [parent.SheetID]: data }));
        } catch (err) {
          console.error(`❌ Failed to load revisions for SheetID ${parent.SheetID}:`, err);
        }
      }
    }
  
    if (Array.isArray(parents) && parents.length > 0) {
      fetchAllRevisions();
    }
  }, [parents]);
  
  useEffect(() => {
    console.log("👀 Loaded parent datasheets:", parents);
  }, [parents]);

  const filteredParents = Array.isArray(parents)
  ? parents.filter((p) => {
      if (filterStatus === "All") return true;
      return revisions[p.SheetID]?.some((rev) => rev.Status === filterStatus);
    })
  : [];

  return (
    <SecurePage requiredPermission="REVISIONS_VIEW">
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Datasheet Revision Browser</h1>

        <div className="mb-4">
          <label className="mr-2 font-medium">Filter by Status:</label>
          <select
            title="Filter by Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as StatusType)}
            className="px-3 py-1 rounded border"
          >
            <option value="All">All</option>
            <option value="Draft">Draft</option>
            <option value="Verified">Verified</option>
            <option value="Approved">Approved</option>
          </select>
        </div>

        {filteredParents.map((parent) => (
          <div key={parent.SheetID} className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-6">
            <h2 className="text-lg font-semibold mb-2">{parent.SheetName}</h2>
            <ul className="space-y-2">
              {revisions[parent.SheetID]?.map((rev) => (
                <li key={rev.SheetID} className="border px-4 py-2 rounded flex justify-between items-center bg-gray-50 dark:bg-gray-700">
                  <span>
                    Rev {rev.RevisionNum} — <strong>{rev.Status}</strong> {rev.IsLatest ? "✅ Latest" : ""}
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => router.push(`/datasheets/filled/${rev.SheetID}`)}
                      className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >View</button>
                    <button
                      onClick={async () => {
                      const res = await fetch(`http://localhost:5000/api/datasheets/${rev.SheetID}/duplicate`, {
                          method: "POST",
                      });
                      if (res.ok) {
                          const data = await res.json();
                          router.push(`/datasheets/filled/${data.newSheetId}`);
                      } else {
                          alert("Failed to duplicate revision.");
                      }
                      }}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                    >Duplicate</button>
                    <button
                      onClick={() => router.push(`/datasheets/filled/${rev.SheetID}?showLogs=true`)}
                      className="px-2 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
                    >Audit Log</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SecurePage>
  );
}
