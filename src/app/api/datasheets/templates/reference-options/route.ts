import { NextResponse } from "next/server";
import { getTemplateReferenceOptions } from "@/backend/database/templateReferenceQueries";

export async function GET() {
  const options = await getTemplateReferenceOptions();
  return NextResponse.json(options);
}
