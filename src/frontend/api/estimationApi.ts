// src/frontend/api/estimationApi.ts
import type { NewEstimationInput } from "@/types/estimation";

export async function getEstimationById(id: number) {
  const res = await fetch(`/api/backend/estimation/${id}`);
  if (!res.ok) throw new Error("Failed to fetch estimation");
  return res.json();
}

export async function createEstimation(data: NewEstimationInput) {
  const res = await fetch(`/api/backend/estimation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create estimation");
  return res.json();
}

export async function updateEstimation(id: number, data: NewEstimationInput) {
  const res = await fetch(`/api/backend/estimation/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update estimation");
  return res.json();
}