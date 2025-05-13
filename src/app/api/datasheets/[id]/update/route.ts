import { NextRequest, NextResponse } from "next/server";
import { fullTemplateSchema } from "@/validation/datasheetTemplateSchema";
import { updateDatasheetTemplate } from "@/backend/database/templateWriteQueries";
import { ZodError } from "zod";

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // ✅ Safely await params
    const idParam = await Promise.resolve(context.params.id);
    const sheetId = Number(idParam);

    if (isNaN(sheetId)) {
      return NextResponse.json(
        { success: false, error: "Invalid Sheet ID" },
        { status: 400 }
      );
    }

    // ✅ Parse the incoming JSON payload
    const body = await req.json();

    // ✅ Validate using enhanced Zod schema
    const result = fullTemplateSchema.safeParse(body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const formatted = result.error.format();

      console.error("❌ Validation failed:", formatted);

      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          fieldErrors,
          formatted,
        },
        { status: 400 }
      );
    }

    const { datasheet, equipment, subsheets } = result.data;

    console.log("🟢 Validated Datasheet:", datasheet);
    console.log("🟢 Validated Equipment:", equipment);
    console.log("🟢 Validated Subsheets:", subsheets);

    // ✅ Update logic
    const updateSuccess = await updateDatasheetTemplate(
      sheetId,
      datasheet,
      equipment,
      subsheets
    );

    if (updateSuccess) {
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to update template." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("❌ Server error:", err);

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
