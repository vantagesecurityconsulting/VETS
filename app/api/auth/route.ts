import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  createSession,
  destroySession,
  isValidPinFormat,
  verifyPin,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth — log in with a 4-digit PIN.
 * Body: { pin: string }
 */
export async function POST(req: NextRequest) {
  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pin = (body.pin || "").trim();
  if (!isValidPinFormat(pin)) {
    return NextResponse.json(
      { error: "PIN must be 4 digits." },
      { status: 400 }
    );
  }

  // PINs are hashed, so compare against each active user.
  const { rows } = await sql`
    SELECT id, name, pin, role, must_change_pin
    FROM users
    WHERE is_active = true;
  `;

  for (const user of rows) {
    if (await verifyPin(pin, user.pin)) {
      await createSession({
        userId: user.id,
        name: user.name,
        role: user.role,
        mustChangePin: user.must_change_pin,
      });
      return NextResponse.json({
        success: true,
        role: user.role,
        mustChangePin: user.must_change_pin,
      });
    }
  }

  return NextResponse.json(
    { error: "Incorrect PIN. Please try again." },
    { status: 401 }
  );
}

/**
 * DELETE /api/auth — log out.
 */
export async function DELETE() {
  await destroySession();
  return NextResponse.json({ success: true });
}
