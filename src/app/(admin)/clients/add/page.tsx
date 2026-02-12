"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";

export default function AddClientPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  }

  const router = useRouter();
  const [formData, setFormData] = useState({
    ClientCode: "",
    ClientName: "",
    ClientEmail: "",
    ClientPhone: "",
    ClientAddress: "",
    ContactPerson: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [backendError, setBackendError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // 🔹 Handle Input Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // Clear validation errors on input
  };

  // 🔹 Validate Form Fields
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.ClientCode.trim()) newErrors.ClientCode = "Client Code is required";
    if (!formData.ClientName.trim()) newErrors.ClientName = "Client Name is required";
    if (!formData.ClientEmail.trim()) newErrors.ClientEmail = "Email is required";
    if (!/\S+@\S+\.\S+/.test(formData.ClientEmail)) newErrors.ClientEmail = "Invalid email format";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Returns false if there are errors
  };

  // 🔹 Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackendError("");
    setSuccess("");

    if (!validateForm()) return; // Stop if form is invalid

    setLoading(true); // Show loading indicator

    try {
      const res = await fetch(`${baseUrl}/api/backend/settings/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add client");
      }

      setSuccess("Client added successfully!");
      setTimeout(() => router.push("/clients"), 2000);
    } catch (error) {
      if (error instanceof Error) {
        setBackendError(error.message);
      } else {
        setBackendError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <AppSidebar />

      <div className="flex-1 flex flex-col">
        <AppHeader />

        <main className="p-6 max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-lg">
          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Add New Client</h1>

          {backendError && <p className="text-red-500">{backendError}</p>}
          {success && <p className="text-green-500">{success}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Client Code */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Client Code</label>
              <input
                type="text"
                name="ClientCode"
                placeholder="Client Code"
                value={formData.ClientCode}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.ClientCode && <p className="text-red-500">{errors.ClientCode}</p>}
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Client Name</label>
              <input
                type="text"
                name="ClientName"
                placeholder="Client Name"
                value={formData.ClientName}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.ClientName && <p className="text-red-500">{errors.ClientName}</p>}
            </div>

            {/* Client Email */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                name="ClientEmail"
                placeholder="Email"
                value={formData.ClientEmail}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {errors.ClientEmail && <p className="text-red-500">{errors.ClientEmail}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Phone Number</label>
              <input
                type="text"
                name="ClientPhone"
                placeholder="Phone Number"
                value={formData.ClientPhone}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Address</label>
              <input
                type="text"
                name="ClientAddress"
                placeholder="Address"
                value={formData.ClientAddress}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300">Contact Person</label>
              <input
                type="text"
                name="ContactPerson"
                placeholder="Contact Person"
                value={formData.ContactPerson}
                onChange={handleChange}
                className="w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full p-3 rounded ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {loading ? "Adding Client..." : "Add Client"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
