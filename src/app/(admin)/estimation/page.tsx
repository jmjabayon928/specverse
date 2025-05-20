'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const Select = dynamic(() => import("react-select"), { ssr: false });
import EstimationTable from "@/components/estimation/EstimationTable";

export default function EstimationDashboardPage() {
  const [searchText, setSearchText] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<{ value: string; label: string }[]>([]);
  const [selectedClients, setSelectedClients] = useState<{ value: number; label: string }[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<{ value: number; label: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ value: number; label: string }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ value: number; label: string }[]>([]);

  const [estimations, setEstimations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const statusOptions = [
    { value: "Draft", label: "Draft" },
    { value: "For Review", label: "For Review" },
    { value: "Approved", label: "Approved" },
  ];

  useEffect(() => {
    async function loadOptions() {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch("/api/backend/clients").then(res => res.json()),
        fetch("/api/backend/projects").then(res => res.json()),
      ]);
      setClientOptions(Array.isArray(clientsRes) ? clientsRes.map(c => ({ value: c.ClientID, label: c.ClientName })) : []);
      setProjectOptions(Array.isArray(projectsRes) ? projectsRes.map(p => ({ value: p.ProjID, label: p.ProjName })) : []);
    }
    loadOptions();
  }, []);

  useEffect(() => {
    async function fetchEstimations() {
      const res = await fetch("/api/backend/estimation/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statuses: selectedStatuses.map(s => s.value),
          clients: selectedClients.map(c => c.value),
          projects: selectedProjects.map(p => p.value),
          search: searchText,
          page,
          pageSize
        }),
      });
      const json = await res.json();
      setEstimations(Array.isArray(json.data) ? json.data : []);
      setTotalCount(typeof json.totalCount === 'number' ? json.totalCount : 0);
    }
    fetchEstimations();
  }, [selectedStatuses, selectedClients, selectedProjects, searchText, page]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Project Estimation Dashboard</h1>

      {/* Filter / Search / Create */}
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div className="flex flex-wrap gap-4">
          <div className="w-60">
            <label className="text-sm font-semibold">Status</label>
            <Select
              isMulti
              options={statusOptions}
              value={selectedStatuses}
              onChange={(value) => {
                setSelectedStatuses(value as { value: string; label: string }[]);
                setPage(1);
              }}
              placeholder="All Statuses"
            />
          </div>

          <div className="w-60">
            <label className="text-sm font-semibold">Client</label>
            <Select
              isMulti
              options={clientOptions}
              value={selectedClients}
              onChange={(value) => {
                setSelectedClients(value as { value: number; label: string }[]);
                setPage(1);
              }}
              placeholder="All Clients"
            />
          </div>

          <div className="w-60">
            <label className="text-sm font-semibold">Project</label>
            <Select
              isMulti
              options={projectOptions}
              value={selectedProjects}
              onChange={(value) => {
                setSelectedProjects(value as { value: number; label: string }[]);
                setPage(1);
              }}
              placeholder="All Projects"
            />
          </div>

          <div className="w-64">
            <label className="text-sm font-semibold">Search</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              placeholder="Search title or description"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/estimation/create"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition"
          >
            + Create Estimation
          </Link>
          <button
            onClick={async () => {
              const res = await fetch("/api/backend/estimation/export/filter/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  statuses: selectedStatuses.map(s => s.value),
                  clients: selectedClients.map(c => c.value),
                  projects: selectedProjects.map(p => p.value),
                  search: searchText
                })
              });
              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "Filtered-Estimations.pdf";
              document.body.appendChild(link);
              link.click();
              link.remove();
            }}
            className="inline-block bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition"
          >
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <EstimationTable
        estimations={estimations}
        onDelete={() => setPage(1)}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              onClick={() => setPage(pg)}
              className={`px-3 py-1 rounded border text-sm ${
                pg === page ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-100"
              }`}
            >
              {pg}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
