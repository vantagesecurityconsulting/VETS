import { NextResponse } from "next/server";
import { tablesExist } from "@/lib/db";
import { createTables, seedData } from "@/lib/init";
import { validateEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    validateEnv();
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }

  try {
    if (await tablesExist()) {
      return NextResponse.json(
        {
          success: false,
          message: "Database already initialized. Setup can only be run once.",
        },
        { status: 409 }
      );
    }

    await createTables();
    await seedData();

    return NextResponse.json({
      success: true,
      message: "Database initialized and seeded",
    });
  } catch (err) {
    console.error("Setup failed:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
