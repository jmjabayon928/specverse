"use client";
import { useEffect, useState } from "react";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import { useRouter } from "next/navigation";
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
  const rowsPerPage = 10; // Set how many rows per page
  const router = useRouter();

  useEffect(() => {
    fetch("http://localhost:5000/api/datasheets")
      .then((response) => response.json())
      .then((data) => setDatasheets(data))
      .catch((error) => console.error("Error fetching datasheets:", error));
  }, []);

  // Filter datasheets based on search term (case-insensitive)
  const filteredDatasheets = datasheets.filter((sheet) =>
    Object.values(sheet).some((value) =>
      typeof value === "string" && value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Pagination: Calculate total pages
  const totalPages = Math.ceil(filteredDatasheets.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedDatasheets = filteredDatasheets.slice(startIndex, startIndex + rowsPerPage);


  const handleDelete = async (sheetId: number) => {
    if (!window.confirm("Are you sure you want to delete this datasheet?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/datasheets/${sheetId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to delete datasheet.");

      alert("✅ DataSheet deleted successfully.");
      window.location.reload();
    } catch (error) {
      console.error("⛔ Error deleting datasheet:", error);
      alert("❌ Failed to delete datasheet.");
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-screen-2xl">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Unfilled DataSheets
        </h1>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-start sm:items-center">
          {/* Search */}
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

          {/* Add DataSheet Button */}
          <button
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 w-full sm:w-auto"
            onClick={() => router.push("/datasheets/unfilled/add")}
          >
            + Add DataSheet
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto shadow-md rounded-lg transition-colors duration-300 bg-white dark:bg-gray-800">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                  <th className="border border-gray-300 px-4 py-2">Client Doc#</th>
                  <th className="border border-gray-300 px-4 py-2">Company Doc#</th>
                  <th className="border border-gray-300 px-4 py-2">Area</th>
                  <th className="border border-gray-300 px-4 py-2">Rev. Date</th>
                  <th className="border border-gray-300 px-4 py-2">Client</th>
                  <th className="border border-gray-300 px-4 py-2">Sheet Name</th>
                  <th className="border border-gray-300 px-4 py-2">Sheet Desc.</th>
                  <th className="border border-gray-300 px-4 py-2">Manufacturer</th>
                  <th className="border border-gray-300 px-4 py-2">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDatasheets.length > 0 ? (
                  paginatedDatasheets.map((sheet) => (
                    <tr key={sheet.SheetID} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                        <button
                          onClick={() => router.push(`/datasheets/${sheet.SheetID}`)}
                          className="tooltip group relative p-1 text-blue-500 hover:text-blue-700"
                          title="View Datasheet"
                          aria-label="View Datasheet"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => router.push(`/datasheets/${sheet.SheetID}/edit`)}
                          className="tooltip group relative p-1 text-yellow-500 hover:text-yellow-700"
                          title="Edit Datasheet"
                          aria-label="Edit Datasheet"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDelete(sheet.SheetID)}
                          className="tooltip group relative p-1 text-red-500 hover:text-red-700"
                          title="Delete Datasheet"
                          aria-label="Delete Datasheet"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.ClientDocNum}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.CompanyDocNum}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.AreaName}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.RevisionDate}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.ClientName}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.SheetNameEng}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.SheetDescEng}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.ManuName}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{sheet.SuppName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="border px-4 py-2 text-center">No datasheets found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-center mt-4">
            <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
              ◀ Previous
            </button>
            <span className="mx-4">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
              Next ▶
            </button>
          </div>
    </div>
  );
}
