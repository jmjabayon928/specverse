'use client';

import Link from "next/link";
import { useState } from "react";
import { useEstimationData } from "@/hooks/useEstimationData";
import EstimationTable from "@/components/estimation/EstimationTable";

export default function EstimationDashboardPage() {
  const { data: estimations, loading } = useEstimationData();

  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Date");
  const [searchText, setSearchText] = useState<string>("");

  const filtered = estimations
    .filter((e) => {
      const matchesStatus = statusFilter === "All" || e.Status === statusFilter;
      const matchesSearch = e.Title.toLowerCase().includes(searchText.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "Title") {
        return a.Title.localeCompare(b.Title);
      } else {
        return new Date(b.EstimationDate).getTime() - new Date(a.EstimationDate).getTime();
      }
    });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Project Estimation Dashboard</h1>

      {/* Filter / Sort / Search / Create */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-4">
          {/* Status Filter */}
          <select
            className="border px-2 py-1 rounded"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title="Filter by Status"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="For Review">For Review</option>
            <option value="Approved">Approved</option>
          </select>

          {/* Sort By */}
          <select
            className="border px-2 py-1 rounded"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="Sort By"
          >
            <option value="Date">Sort by Date</option>
            <option value="Title">Sort by Title</option>
          </select>

          {/* Search */}
          <input
            type="text"
            className="border px-2 py-1 rounded"
            placeholder="Search title..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Create Button */}
        <Link
          href="/estimation/create"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition"
        >
          + Create Estimation
        </Link>
      </div>

      {/* Table */}
      {loading ? (
        <div>Loading estimations...</div>
      ) : (
        <EstimationTable
          estimations={filtered}
          onDelete={() => window.location.reload()} // simple refresh
        />
      )}
    </div>
  );
}
