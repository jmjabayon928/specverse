"use client";

import React, { useState } from "react";

export default function InventoryFilters() {
  const [search, setSearch] = useState("");

  const handleSearch = () => {
    console.warn(`TODO: Perform search for "${search}"`);
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by item name or code"
        className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        onClick={handleSearch}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Search
      </button>
    </div>
  );
}
