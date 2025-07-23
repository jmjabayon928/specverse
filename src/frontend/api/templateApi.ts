// src/frontend/api/templateApi.ts
import type { FullTemplateInput } from "@/validation/sheetSchema";

export async function createTemplate(data: FullTemplateInput) {
  const res = await fetch("/api/backend/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create template");
  return res.json();
}

export async function updateTemplate(id: number, data: FullTemplateInput) {
  const res = await fetch(`/api/backend/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update template");
  return res.json();
}

export async function getTemplateById(id: number) {
  const res = await fetch(`/api/backend/templates/${id}`);
  if (!res.ok) throw new Error("Failed to fetch template");
  return res.json();
}

export async function verifyTemplate(id: number, notes: string) {
  const res = await fetch(`/api/backend/templates/${id}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to verify template");
  return res.json();
}

export async function approveTemplate(id: number, notes: string) {
  const res = await fetch(`/api/backend/templates/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to approve template");
  return res.json();
}

export async function rejectTemplate(id: number, notes: string) {
  const res = await fetch(`/api/backend/templates/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to reject template");
  return res.json();
}