// src/app/api/sessions/bulk-invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendBulkInviteEmail } from "../../../api/_utils/bulk-email";

export async function POST(req: NextRequest) {
  try {
    const { email, sessions, eventId, facultyName } = await req.json();

    if (!email || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, sessions" },
        { status: 400 }
      );
    }

    console.log(
      `Sending bulk invitation to ${email} for ${sessions.length} sessions`
    );

    const result = await sendBulkInviteEmail({
      facultyEmail: email,
      facultyName: facultyName || "Faculty Member",
      sessions: sessions,
      eventId: eventId,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Bulk invitation sent to ${email}`,
        emailSent: true,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send bulk invitation",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error sending bulk invitation:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error?.message || "",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
