"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import SidebarWidget from "@/layout/SidebarWidget";
import Backdrop from "@/layout/Backdrop";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline"; // Icons

type Client = {
  ClientID: number;
  ClientCode: string;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
};

export default function ClientDetailPage() {
  const params = useParams(); // ✅ Get params object
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:5000/api/clients/${id}`)
        .then((response) => response.json())
        .then((data) => {
        if (data.error) {
            setClient(null);
        } else {
            setClient(data);
        }
        setLoading(false);
        })
        .catch((error) => {
        console.error("Error fetching client:", error);
        setLoading(false);
        });
  }, [id]);

  // Handle delete action
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/clients/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete client.");
      }

      alert("✅ Client deleted successfully.");
      router.push("/clients"); // Redirect to clients list
    } catch (error) {
      console.error("⛔ Error deleting client:", error);
      alert("❌ Failed to delete client.");
    }
  };

  if (loading) {
    return <p className="text-center p-6">Loading client details...</p>;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push("/clients")}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back to Clients
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex transition-colors duration-300 bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AppHeader />

        {/* Page Content */}
        <main className="p-4 mx-auto max-w-screen-2xl md:p-6 transition-colors duration-300">
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Client Details
          </h1>

          <div className="flex gap-3">
              {/* Edit Client */}
              <button
                onClick={() => router.push(`/clients/${id}/edit`)}
                className="tooltip group relative p-2 text-yellow-500 hover:text-yellow-700"
                title="Edit Client"
                aria-label="Edit Client"
              >
                <PencilIcon className="w-6 h-6" />
              </button>

              {/* Delete Client */}
              <button
                onClick={handleDelete}
                className="tooltip group relative p-2 text-red-500 hover:text-red-700"
                title="Delete Client"
                aria-label="Delete Client"
              >
                <TrashIcon className="w-6 h-6" />
              </button>
            </div>

          {client && (
            <div className="shadow-md rounded-lg p-6 transition-colors duration-300 bg-white dark:bg-gray-800">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {client.ClientName}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>Email:</strong> {client.ClientEmail}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>Phone:</strong> {client.ClientPhone}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>Address:</strong> {client.ClientAddress}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>Contact Person:</strong> {client.ContactPerson}
              </p>

              <button
                onClick={() => router.push("/clients")}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Back to Clients List
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
