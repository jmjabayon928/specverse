"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
//import { useTheme } from "next-themes";
import { EyeIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

type Client = {
  ClientID: number;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
};

export default function ClientsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  }

  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  //const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    fetch(`${baseUrl}/api/backend/settings/clients`)
      .then((response) => response.json())
      .then((data) => setClients(data))
      .catch((error) => console.error("Error fetching clients:", error));
  }, [baseUrl]);

  const filteredClients = clients.filter((client) =>
    Object.values(client).some(
      (value) =>
        typeof value === "string" &&
        value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleDelete = async (clientId: number) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;

    try {
      const response = await fetch(`${baseUrl}/api/backend/settings/clients/${clientId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete client.");
      }

      alert("✅ Client deleted successfully.");
      window.location.reload();
    } catch (error) {
      console.error("⛔ Error deleting client:", error);
      alert("❌ Failed to delete client.");
    }
  };

  return (
    <div className="p-4 md:p-6 mx-auto w-full max-w-screen-2xl">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Clients
        </h1>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-start sm:items-center">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 pl-10 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>

          {/* Add Client Button */}
          <button
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 w-full sm:w-auto"
            onClick={() => router.push("/clients/add")}
          >
            + Add Client
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border px-4 py-2 text-center text-gray-900 dark:text-gray-100">Actions</th>
              <th className="border px-4 py-2 text-left text-gray-900 dark:text-gray-100">Name</th>
              <th className="border px-4 py-2 text-left text-gray-900 dark:text-gray-100">Email</th>
              <th className="border px-4 py-2 text-left text-gray-900 dark:text-gray-100">Phone</th>
              <th className="border px-4 py-2 text-left text-gray-900 dark:text-gray-100">Address</th>
              <th className="border px-4 py-2 text-left text-gray-900 dark:text-gray-100">Contact Person</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <tr key={client.ClientID} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="border px-4 py-2 flex justify-center gap-2">
                    {/* View */}
                    <button
                      onClick={() => router.push(`/clients/${client.ClientID}`)}
                      className="p-1 text-blue-500 hover:text-blue-700"
                      title="View Client"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => router.push(`/clients/${client.ClientID}/edit`)}
                      className="p-1 text-yellow-500 hover:text-yellow-700"
                      title="Edit Client"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(client.ClientID)}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Delete Client"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="border px-4 py-2">{client.ClientName}</td>
                  <td className="border px-4 py-2">{client.ClientEmail}</td>
                  <td className="border px-4 py-2">{client.ClientPhone}</td>
                  <td className="border px-4 py-2">{client.ClientAddress}</td>
                  <td className="border px-4 py-2">{client.ContactPerson}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="border px-4 py-2 text-center text-gray-500 dark:text-gray-400"
                >
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
