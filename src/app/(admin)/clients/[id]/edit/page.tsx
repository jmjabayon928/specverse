"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import SidebarWidget from "@/layout/SidebarWidget";
import Backdrop from "@/layout/Backdrop";

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams(); // ✅ Ensure `useParams()` is used correctly
  const id = params?.id as string;
  const [client, setClient] = useState({
    ClientName: "",
    ClientEmail: "",
    ClientPhone: "",
    ClientAddress: "",
    ContactPerson: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch client data when page loads
  useEffect(() => {
    async function fetchClient() {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/clients/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch client data");
        }
        const data = await response.json();
        setClient(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchClient();
  }, [id]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!client.ClientName || !client.ClientEmail || !client.ClientPhone) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });

      if (!response.ok) {
        throw new Error("Failed to update client");
      }

      alert("Client updated successfully!");
      router.push("/clients");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClient({ ...client, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <AppSidebar />
      <SidebarWidget />
      <Backdrop />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <AppHeader />

        {/* Page Content */}
        <main className="p-6 mx-auto max-w-3xl bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4">Update Client</h1>

          {error && <p className="text-red-500">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Client Name</label>
              <input
                type="text"
                name="ClientName"
                value={client.ClientName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700"
                title="Client Name"
                aria-label="Client Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                name="ClientEmail"
                value={client.ClientEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700"
                title="Client Email"
                aria-label="Client Email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input
                type="text"
                name="ClientPhone"
                value={client.ClientPhone}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700"
                title="Client Phone"
                aria-label="Client Phone"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Address</label>
              <input
                type="text"
                name="ClientAddress"
                value={client.ClientAddress}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700"
                title="Client Address"
                aria-label="Client Address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Contact Person</label>
              <input
                type="text"
                name="ContactPerson"
                value={client.ContactPerson}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md dark:bg-gray-700"
                title="Contact Person"
                aria-label="Client Person"
/>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Client"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
