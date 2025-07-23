// src/frontend/api/filledApi.ts
import type { FullTemplateInput } from "@/validation/sheetSchema";

export async function createFilledSheet(data: FullTemplateInput) {
  const res = await fetch("/api/backend/filled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create filled datasheet");
  return res.json();
}

export async function updateFilledSheet(id: number, data: FullTemplateInput) {
  const res = await fetch(`/api/backend/filled/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update filled datasheet");
  return res.json();
}

export async function getFilledSheetById(id: number) {
  const res = await fetch(`/api/backend/filled/${id}`);
  if (!res.ok) throw new Error("Failed to fetch filled datasheet");
  return res.json();
}

export async function verifyFilledSheet(id: number, notes: string) {
  const res = await fetch(`/api/backend/filled/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to verify filled datasheet");
  return res.json();
}

export async function approveFilledSheet(id: number, notes: string) {
  const res = await fetch(`/api/backend/filled/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to approve filled datasheet");
  return res.json();
}

export async function rejectFilledSheet(id: number, notes: string) {
  const res = await fetch(`/api/backend/filled/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to reject filled datasheet");
  return res.json();
}