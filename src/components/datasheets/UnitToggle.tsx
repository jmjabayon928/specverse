// src/components/datasheets/UnitToggle.tsx
"use client";
import React from "react";

interface Props {
  unitSystem: "SI" | "USC";
  onToggle: (unit: "SI" | "USC") => void;
}

const UnitToggle: React.FC<Props> = ({ unitSystem, onToggle }) => {
  const toggle = () => {
    const newUnit = unitSystem === "SI" ? "USC" : "SI";
    onToggle(newUnit);
  };

  return (
    <button
      onClick={toggle}
      className={`border px-3 py-1 rounded text-sm ${
        unitSystem === "SI" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
      }`}
      title="Toggle Unit System"
    >
      {unitSystem}
    </button>
  );
};

export default UnitToggle;
