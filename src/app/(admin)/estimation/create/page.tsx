"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ProjectOption = {
  id: number;
  name: string;
};

export default function CreateEstimationPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    fetch("/api/backend/datasheets/templates/reference-options")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects || []);
      });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/backend/estimation/", {
      method: "POST",
      body: JSON.stringify({
        ProjectID: parseInt(projectId),
        Title: title,
        Description: description,
        CreatedBy: 1, // Replace with current user ID from session in production
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      alert("Estimation created!");
      router.push("/estimation");
    } else {
      alert("Failed to create estimation.");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-6 bg-white shadow-md rounded-md p-6">
      <h2 className="text-xl font-bold mb-4">Create New Project Estimation</h2>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label htmlFor="Project" className="block text-sm font-medium mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full border rounded px-3 py-2"
            title="Project"
            required
          >
            <option value="">-- Select Project --</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="Title" className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Piping System Estimate"
            required
          />
        </div>

        <div>
          <label htmlFor="Description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this estimation"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Estimation
        </button>
      </form>
    </div>
  );
}
