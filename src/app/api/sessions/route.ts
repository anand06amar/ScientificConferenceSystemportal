// src/app/api/sessions/route.ts - UPDATED with Dynamic Faculty Invitations & Field Mapping Fix
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  getAllSessions,
  getFaculties,
  getRooms,
  getSessionById,
} from "@/lib/database/session-queries";
import { createSessionWithEvent } from "@/lib/database/event-session-integration";
import { sendInviteEmail } from "../_utils/session-email";

// Helper function to parse datetime-local strings consistently
function parseLocalDateTime(dateTimeStr: string) {
  if (!dateTimeStr) return null;

  try {
    if (
      dateTimeStr.includes("T") &&
      !dateTimeStr.includes("Z") &&
      dateTimeStr.length <= 19
    ) {
      return dateTimeStr.endsWith(":00") ? dateTimeStr : dateTimeStr + ":00";
    } else {
      return new Date(dateTimeStr).toISOString();
    }
  } catch (error) {
    console.error("Error parsing datetime:", error);
    return null;
  }
}

// Helper function to check for scheduling conflicts
async function checkSessionConflicts(
  sessionData: {
    facultyId: string;
    roomId: string;
    startTime: string;
    endTime: string;
  },
  excludeSessionId?: string
) {
  const allSessions = await getAllSessions();
  const conflicts = [];

  const newStart = new Date(sessionData.startTime);
  const newEnd = new Date(sessionData.endTime);

  for (const existingSession of allSessions) {
    if (excludeSessionId && existingSession.id === excludeSessionId) {
      continue;
    }

    const existingStart = new Date(existingSession.startTime);
    const existingEnd = new Date(existingSession.endTime);

    const hasTimeOverlap = newStart < existingEnd && newEnd > existingStart;

    if (hasTimeOverlap) {
      if (existingSession.facultyId === sessionData.facultyId) {
        conflicts.push({
          id: existingSession.id,
          title: existingSession.title,
          facultyId: existingSession.facultyId,
          roomId: existingSession.hallId,
          startTime: existingSession.startTime,
          endTime: existingSession.endTime,
          type: "faculty",
          message: `Faculty is already scheduled for "${existingSession.title}" during this time`,
          sessionTitle: existingSession.title,
        });
      }

      if (existingSession.hallId === sessionData.roomId) {
        conflicts.push({
          id: existingSession.id,
          title: existingSession.title,
          facultyId: existingSession.facultyId,
          roomId: existingSession.hallId,
          startTime: existingSession.startTime,
          endTime: existingSession.endTime,
          type: "room",
          message: `Room is already booked for "${existingSession.title}" during this time`,
          sessionTitle: existingSession.title,
        });
      }
    }
  }

  return conflicts;
}

// GET: list all sessions enriched for listing pages
export async function GET() {
  try {
    const sessions = await getAllSessions();
    const faculties = await getFaculties();
    const rooms = await getRooms();

    const enriched = sessions.map((s) => {
      const faculty = faculties.find((f) => f.id === s.facultyId);
      const room = rooms.find((r) => r.id === s.hallId);

      let durationMin = 0;
      try {
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        durationMin = Math.max(
          0,
          Math.round((end.getTime() - start.getTime()) / 60000)
        );
      } catch (error) {
        // Handle invalid dates gracefully
      }

      return {
        ...s,
        facultyName: s.facultyName || faculty?.name || "Unknown Faculty",
        roomName: s.roomName || room?.name || s.hallId || "Unknown Room",
        roomId: s.hallId,
        email: s.facultyEmail || faculty?.email || "",
        duration: durationMin > 0 ? `${durationMin} minutes` : "",
        formattedStartTime: s.startTime,
        formattedEndTime: s.endTime,
        // ENHANCED: Add invitation status for UI
        eventName: s.eventName || "Unknown Event",
        invitationStatus: s.inviteStatus || "Pending",
        canTrack: !!(s.facultyEmail && s.inviteStatus),
      };
    });

    console.log("API Response first session:", enriched[0]); // Debug line
    console.log(
      "🔍 Sessions data before sending:",
      enriched.map((s) => ({
        title: s.title,
        eventName: s.eventName,
        originalEventName: s.eventName,
      }))
    );

    return NextResponse.json(
      { success: true, data: { sessions: enriched }, count: enriched.length },
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("❌ Error fetching sessions:", e);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: e?.message || "",
      },
      { status: 500 }
    );
  }
}

// POST: create a session with DYNAMIC faculty invitations
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported content type. Use multipart/form-data",
        },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    // ✅ FIXED: Extract fields with both naming conventions
    const title = formData.get("title")?.toString() || "";
    const facultyId = formData.get("facultyId")?.toString() || "";
    const email = formData.get("email")?.toString() || "";
    const place = formData.get("place")?.toString() || "";
    const roomId = formData.get("roomId")?.toString() || "";
    const description = formData.get("description")?.toString() || "";

    // ✅ FIXED: Handle both old and new field names for time
    const startTime =
      formData.get("startTime")?.toString() ||
      formData.get("suggested_time_start")?.toString() ||
      "";
    const endTime =
      formData.get("endTime")?.toString() ||
      formData.get("suggested_time_end")?.toString() ||
      "";

    const eventId =
      formData.get("eventId")?.toString() || "default-conference-2025";
    const status =
      (formData.get("status")?.toString() as "Draft" | "Confirmed") || "Draft";

    // ✅ FIXED: Handle invite_status field name
    const inviteStatus =
      formData.get("inviteStatus")?.toString() ||
      formData.get("invite_status")?.toString() ||
      "Pending";

    const travel =
      formData.get("travel")?.toString() ||
      formData.get("travelStatus")?.toString();
    const accommodation = formData.get("accommodation")?.toString();

    const travelRequired = travel === "yes" || travel === "true";
    const accommodationRequired =
      accommodation === "yes" || accommodation === "true";

    console.log("📋 Creating session with DYNAMIC invitations:", {
      title,
      facultyId,
      email,
      place,
      roomId,
      startTime,
      endTime,
      eventId,
      status,
      inviteStatus,
      travel: travelRequired,
      accommodation: accommodationRequired,
    });

    // ✅ FIXED: Updated validation - don't require times for date-based sessions
    const missingFields = [];
    if (!title) missingFields.push("title");
    if (!facultyId) missingFields.push("facultyId");
    if (!email) missingFields.push("email");
    if (!place) missingFields.push("place");
    if (!roomId) missingFields.push("roomId");
    if (!description) missingFields.push("description");

    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          receivedFields: Object.fromEntries(formData.entries()),
        },
        { status: 400 }
      );
    }

    // ✅ FIXED: Handle time parsing with fallback for date-based sessions
    let finalStartTime: string;
    let finalEndTime: string;

    try {
      // If no times provided, generate default times for the date
      if (!startTime || !endTime) {
        console.log(
          "⚠️ No times provided, generating default times for date-based session"
        );

        // Try to extract date from startTime if it's a date string
        let baseDate = new Date();
        if (startTime) {
          try {
            baseDate = new Date(startTime);
          } catch (e) {
            console.log("Could not parse startTime as date, using today");
          }
        }

        // Set default times: 9 AM to 5 PM on the specified date
        const startDate = new Date(baseDate);
        startDate.setHours(9, 0, 0, 0);
        const endDate = new Date(baseDate);
        endDate.setHours(17, 0, 0, 0);

        finalStartTime = startDate.toISOString();
        finalEndTime = endDate.toISOString();

        console.log("✅ Generated default times:", {
          finalStart: finalStartTime,
          finalEnd: finalEndTime,
        });
      } else {
        // Parse provided times
        const parsedStartTime = parseLocalDateTime(startTime);
        const parsedEndTime = parseLocalDateTime(endTime);

        if (!parsedStartTime) {
          throw new Error("Invalid start time format");
        }

        finalStartTime = parsedStartTime;

        if (!parsedEndTime) {
          const startDate = new Date(finalStartTime);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          finalEndTime = endDate.toISOString();
        } else {
          finalEndTime = parsedEndTime;
        }
      }

      const start = new Date(finalStartTime);
      const end = new Date(finalEndTime);

      if (end <= start) {
        return NextResponse.json(
          { success: false, error: "End time must be after start time" },
          { status: 400 }
        );
      }

      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      if (durationMinutes < 15) {
        return NextResponse.json(
          { success: false, error: "Session must be at least 15 minutes long" },
          { status: 400 }
        );
      }

      console.log("✅ Time validation passed:", {
        finalStart: finalStartTime,
        finalEnd: finalEndTime,
        duration: `${durationMinutes} minutes`,
      });
    } catch (timeError) {
      console.error("❌ Time parsing error:", timeError);
      return NextResponse.json(
        {
          success: false,
          error: `Time parsing failed: ${timeError}`,
          providedTimes: { startTime, endTime },
        },
        { status: 400 }
      );
    }

    // ✅ UPDATED: Skip conflict checking for date-based sessions (since times are just placeholders)
    const conflictOnly = formData.get("conflictOnly")?.toString() === "true";
    const overwriteConflicts =
      formData.get("overwriteConflicts")?.toString() === "true";

    if (conflictOnly) {
      // For date-based sessions, return no conflicts
      return NextResponse.json({
        success: true,
        conflicts: [],
        hasConflicts: false,
        message: "Date-based sessions don't check for time conflicts",
      });
    }

    // Generate session ID
    const sessionId = randomUUID();

    // ✅ FIXED: Create session with proper field mapping
    const sessionData = {
      sessionId,
      eventId,
      title,
      description,
      startTime: finalStartTime,
      endTime: finalEndTime,
      hallId: roomId,
      facultyId,
      facultyEmail: email,
      place,
      status,
      inviteStatus: inviteStatus as "Pending" | "Accepted" | "Declined",
      travel: travelRequired,
      accommodation: accommodationRequired,
    };

    console.log("✅ Creating session with proper field mapping:", sessionData);

    // Use enhanced createSessionWithEvent function
    const createdSessionId = await createSessionWithEvent(sessionData);

    // Verify session was created
    const verify = await getSessionById(createdSessionId);
    if (!verify) {
      return NextResponse.json(
        { success: false, error: "Failed to save session to database" },
        { status: 500 }
      );
    }

    console.log(
      "✅ Session verified with dynamic invitation tracking:",
      verify.inviteStatus
    );

    // Get faculty and room info for response
    const faculties = await getFaculties();
    const rooms = await getRooms();
    const faculty = faculties.find((f) => f.id === facultyId);
    const room = rooms.find((r) => r.id === roomId);

    // Prepare enhanced session data for response
    const sessionForResponse = {
      id: createdSessionId,
      title,
      facultyId,
      email,
      place,
      roomId,
      roomName: room?.name || roomId,
      description,
      startTime: finalStartTime,
      endTime: finalEndTime,
      status,
      inviteStatus: inviteStatus as "Pending",
      eventId,
      // ENHANCED: Add invitation tracking info
      invitationSent: true,
      canTrackResponse: true,
      responseUrl: `/api/faculty/respond?sessionId=${createdSessionId}&facultyEmail=${email}`,
      travel: travelRequired,
      accommodation: accommodationRequired,
    };

    // ✅ ENHANCED: Send invitation email with response tracking
    try {
      const result = await sendInviteEmail(
        sessionForResponse,
        faculty?.name || "Faculty Member",
        email
      );

      if (!result.ok) {
        console.warn(
          "⚠️ Email failed but session created with dynamic tracking:",
          result.message
        );
        return NextResponse.json(
          {
            success: true,
            emailStatus: "failed",
            warning:
              "Session created with invitation tracking, but email could not be sent",
            data: {
              ...sessionForResponse,
              facultyName: faculty?.name,
              roomName: room?.name,
              invitationTracking: "enabled",
            },
          },
          { status: 201 }
        );
      }

      console.log(
        "✅ Session created successfully with dynamic invitation system"
      );
      return NextResponse.json(
        {
          success: true,
          emailStatus: "sent",
          message: "Session created with dynamic faculty invitation tracking",
          data: {
            ...sessionForResponse,
            facultyName: faculty?.name,
            roomName: room?.name,
            invitationTracking: "enabled",
            emailSent: true,
          },
        },
        { status: 201 }
      );
    } catch (emailError: any) {
      console.error("❌ Email sending error:", emailError);
      return NextResponse.json(
        {
          success: true,
          emailStatus: "error",
          warning:
            "Session created with invitation tracking, but email failed: " +
            (emailError?.message || "Unknown error"),
          data: {
            ...sessionForResponse,
            facultyName: faculty?.name,
            roomName: room?.name,
            invitationTracking: "enabled",
          },
        },
        { status: 201 }
      );
    }
  } catch (err: any) {
    console.error("❌ Error creating session with dynamic invitations:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: err?.message || "",
        stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
