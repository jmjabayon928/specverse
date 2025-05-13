// src/app/(admin)/datasheets/filled/page.tsx

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { EyeIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

type DataSheet = {
  SheetID: number;
  ClientDocNum: string;
  CompanyDocNum: string;
  AreaName: string;
  RevisionDate: string;
  ClientID: number;
  ClientName: string;
  SheetNameEng: string;
  SheetDescEng: string;
  ManuName: string;
  SuppName: string;
};

export default function DataSheetsPage() {
  const [datasheets, setDatasheets] = useState<DataSheet[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const router = useRouter();

  useEffect(() => {
    fetch("http://localhost:5000/api/backend/datasheets")
      .then((response) => response.json())
      .then((data) => {
        // ✅ Check for either format
        if (data && Array.isArray(data.data)) {
          setDatasheets(data.data);
        } else if (Array.isArray(data)) {
          setDatasheets(data);
        } else {
          console.error("Unexpected datasheets response format:", data);
          setDatasheets([]);
        }
      })
      .catch((error) => console.error("Error fetching datasheets:", error));
  }, []);

  // ✅ Type-safe filter
  const filteredDatasheets = Array.isArray(datasheets)
    ? datasheets.filter((sheet) =>
        Object.values(sheet).some(
          (value) =>
            typeof value === "string" &&
            value.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : [];

  const totalPages = Math.ceil(filteredDatasheets.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedDatasheets = filteredDatasheets.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  const handleDelete = async (sheetId: number) => {
    if (!window.confirm("Are you sure you want to delete this datasheet?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/backend/datasheets/${sheetId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete datasheet.");

      alert("✅ Datasheet deleted successfully.");
      window.location.reload();
    } catch (error) {
      console.error("⛔ Error deleting datasheet:", error);
      alert("❌ Failed to delete datasheet.");
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-screen-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Filled DataSheets
        </h1>

        {/* Search box */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search datasheets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto shadow-md rounded-lg bg-white dark:bg-gray-800">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border px-4 py-2 text-center">Actions</th>
              <th className="border px-4 py-2">Client Doc#</th>
              <th className="border px-4 py-2">Company Doc#</th>
              <th className="border px-4 py-2">Area</th>
              <th className="border px-4 py-2">Rev. Date</th>
              <th className="border px-4 py-2">Client</th>
              <th className="border px-4 py-2">Sheet Name</th>
              <th className="border px-4 py-2">Sheet Desc.</th>
              <th className="border px-4 py-2">Manufacturer</th>
              <th className="border px-4 py-2">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDatasheets.length > 0 ? (
              paginatedDatasheets.map((sheet) => (
                <tr key={sheet.SheetID} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="border px-4 py-2">
                    <button
                      onClick={() => router.push(`/datasheets/filled/${sheet.SheetID}`)}
                      className="p-1 text-blue-500 hover:text-blue-700"
                      title="View"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => router.push(`/datasheets/filled/${sheet.SheetID}/edit`)}
                      className="p-1 text-yellow-500 hover:text-yellow-700"
                      title="Edit"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sheet.SheetID)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="border px-4 py-2">{sheet.ClientDocNum}</td>
                  <td className="border px-4 py-2">{sheet.CompanyDocNum}</td>
                  <td className="border px-4 py-2">{sheet.AreaName}</td>
                  <td className="border px-4 py-2">
                    {sheet.RevisionDate
                      ? format(new Date(sheet.RevisionDate), "MMM dd, yyyy")
                      : "-"}
                  </td>
                  <td className="border px-4 py-2">{sheet.ClientName}</td>
                  <td className="border px-4 py-2">{sheet.SheetNameEng}</td>
                  <td className="border px-4 py-2">{sheet.SheetDescEng}</td>
                  <td className="border px-4 py-2">{sheet.ManuName}</td>
                  <td className="border px-4 py-2">{sheet.SuppName}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="border px-4 py-2 text-center">
                  No datasheets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-4 space-x-4">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          ◀ Previous
        </button>
        <span className="self-center">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
