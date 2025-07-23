// src/components/ui/form/FormHelper.tsx

import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { Option } from "@/types/common";

export function renderInput<T, K extends keyof T>(
  label: string,
  field: K,
  data: T,
  onChange: (field: K, value: T[K]) => void,
  disabled = false,
  errors?: Partial<Record<K, string[]>>,
  type: "text" | "number" = "text"
) {
  const fieldErrors = errors?.[field] ?? [];

  const value = type === "number"
    ? (data[field] !== undefined && data[field] !== null ? Number(data[field]) : "")
    : (data[field] !== undefined && data[field] !== null ? String(data[field]) : "");

  return (
    <div className="flex flex-col">
      <label className="font-medium">{label}</label>
      <input
        type={type}
        title="Input field"
        value={value}
        onChange={(e) => {
          const val = type === "number" ? Number(e.target.value) : e.target.value;
          onChange(field, val as T[K]);
        }}
        disabled={disabled}
        className="border px-2 py-1 rounded"
      />
      {fieldErrors.length > 0 && (
        <span className="text-red-500 text-sm">{fieldErrors[0]}</span>
      )}
    </div>
  );
}

export function renderSelect<T, K extends keyof T>(
  label: string,
  field: K,
  data: T,
  onChange: (field: K, value: T[K]) => void,
  disabled = false,
  options: Option[],
  errors?: Partial<Record<K, string[]>>
) {
  const fieldErrors = errors?.[field] ?? [];

  const value = data[field] !== undefined && data[field] !== null ? String(data[field]) : "0";

  return (
    <div className="flex flex-col">
      <label className="font-medium">{label}</label>
      <select
        value={value}
        title="Select field"
        onChange={(e) => onChange(field, Number(e.target.value) as T[K])}
        disabled={disabled}
        className="border px-2 py-1 rounded"
      >
        <option value={0}>-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {fieldErrors.length > 0 && (
        <span className="text-red-500 text-sm">{fieldErrors[0]}</span>
      )}
    </div>
  );
}

export function renderDate<T, K extends keyof T>(
  label: string,
  field: K,
  data: T,
  onChange: (field: K, value: T[K]) => void,
  disabled = false,
  errors?: Partial<Record<K, string[]>>,
) {
  const fieldErrors = errors?.[field] ?? [];

  return (
    <div className="flex flex-col">
      <label className="font-medium">{label}</label>
      <DatePicker
        selected={data[field] ? new Date(data[field] as string) : null}
        onChange={(date: Date | null) => {
          const value = date?.toISOString().split("T")[0] as T[K];
          onChange(field, value);
        }}
        dateFormat="yyyy-MM-dd"
        className="border px-2 py-1 rounded"
        disabled={disabled}
      />
      {fieldErrors.length > 0 && (
        <span className="text-red-500 text-sm">{fieldErrors[0]}</span>
      )}
    </div>
  );
}
