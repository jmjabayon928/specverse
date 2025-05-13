// src/app/api/datasheets/templates/[templateId]/create-filled/route.ts
import type { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const templateId = Number(params.templateId);

  if (isNaN(templateId)) {
    return new Response(JSON.stringify({ error: "Invalid template ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Call your backend server route
    const backendRes = await fetch(
      `http://localhost:5000/api/datasheets/templates/${templateId}/create-filled`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!backendRes.ok) {
      const error = await backendRes.json();
      return new Response(JSON.stringify(error), {
        status: backendRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await backendRes.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("⛔ Error in templates/[templateId]/create-filled route:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
