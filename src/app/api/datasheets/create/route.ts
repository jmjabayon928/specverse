import { NextRequest, NextResponse } from "next/server";
import { insertTemplate } from "@/backend/services/templateInsertService";
import { fullTemplateSchema } from "@/validation/datasheetTemplateSchema";
import type { FullTemplateInput } from "@/validation/datasheetTemplateSchema";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = fullTemplateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid input", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const validated: FullTemplateInput = result.data;
  const sheetId = await insertTemplate(
    validated.datasheet,
    validated.equipment,
    validated.subsheets
  );

  return NextResponse.json({ success: true, sheetId });
}
