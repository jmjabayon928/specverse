import { getAllTemplates } from "@/backend/database/datasheetTemplateQueries";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const templates = await getAllTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("❌ Error in /api/datasheets/templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
