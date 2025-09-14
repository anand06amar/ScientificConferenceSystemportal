import { sendMail } from "@/lib/mailer";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export type Session = {
  id: string;
  title: string;
  facultyId: string;
  facultyName?: string;
  email: string;
  place: string;
  roomId: string;
  roomName?: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: "Draft" | "Confirmed";
  inviteStatus: "Pending" | "Accepted" | "Declined";
  rejectionReason?: "NotInterested" | "SuggestedTopic" | "TimeConflict";
  suggestedTopic?: string;
  suggestedTimeStart?: string;
  suggestedTimeEnd?: string;
  optionalQuery?: string;
  eventId?: string;
};

function formatDate(val?: string) {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function safe(val?: string) {
  return val || "-";
}

function renderHTML(sessions: Session[], facultyName: string) {
  const firstSession = sessions[0];
  const loginUrl = `${baseUrl.replace(
    /\/+$/,
    ""
  )}/faculty-login?email=${encodeURIComponent(firstSession?.email || "")}`;

  const rows = sessions
    .map(
      (s) => `
      <tr style="border-bottom: 1px solid #eaeaea;">
        <td style="padding:12px; border-right:1px solid #ddd;">${safe(
          s.title
        )}</td>
        <td style="padding:12px; border-right:1px solid #ddd;">${formatDate(
          s.startTime
        )}</td>
        <td style="padding:12px; border-right:1px solid #ddd;">${formatDate(
          s.endTime
        )}</td>
        <td style="padding:12px; border-right:1px solid #ddd;">${safe(
          s.place
        )} - ${safe(s.roomName || s.roomId)}</td>
        <td style="padding:12px;">${safe(s.description)}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Session Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height:1.5; color:#333; max-width:600px; margin:0 auto; padding:20px;">
  <div style="background:linear-gradient(135deg, #667eea, #764ba2); padding:30px; border-radius: 8px 8px 0 0; color:#fff; text-align:center;">
    <h1>🎤 Speaking Invitation</h1>
  </div>
  <div style="background:#fff; padding:30px; border-radius:0 0 8px 8px; border:1px solid #ddd;">
    <p>Hello <strong>${safe(facultyName)}</strong>,</p>
    <p>You are invited to speak at the following ${sessions.length} session${
    sessions.length > 1 ? "s" : ""
  }:</p>
    <table style="width:100%; border-collapse: collapse; margin:20px 0;">
      <thead style="background:#efefef;">
        <tr>
          <th style="text-align:left; padding:12px; border-bottom:1px solid #ddd;">Title</th>
          <th style="text-align:left; padding:12px; border-bottom:1px solid #ddd;">Start</th>
          <th style="text-align:left; padding:12px; border-bottom:1px solid #ddd;">End</th>
          <th style="text-align:left; padding:12px; border-bottom:1px solid #ddd;">Location</th>
          <th style="text-align:left; padding:12px; border-bottom:1px solid #ddd;">Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p style="text-align:center; margin: 30px 0;">
      <a href="${loginUrl}" target="_blank" style="
        background:#764ba2;
        color:#fff;
        padding:15px 25px;
        border-radius:25px;
        text-decoration:none;
        font-weight:bold;
        font-size:16px;
        box-shadow:0 4px 15px rgba(118,75,162,0.4);
        ">
        🔐 Access Faculty Portal
      </a>
    </p>
    <p style="font-size:12px; color:#666; text-align:center;">
      If you have questions, contact your event coordinator. This message was sent automatically.
    </p>
  </div>
</body>
</html>
`;
}

function renderUpdateHTML(
  session: Session,
  facultyName: string,
  roomName: string
) {
  const loginUrl = `${baseUrl.replace(
    /\/+$/,
    ""
  )}/faculty-login?email=${encodeURIComponent(session.email)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Session Updated</title>
</head>
<body style="font-family: Arial, sans-serif; line-height:1.5; color:#333; max-width:600px; margin:0 auto; padding:20px;">
  <div style="background:linear-gradient(135deg, #ff9a56, #ff6b35); padding:30px; border-radius: 8px 8px 0 0; color:#fff; text-align:center;">
    <h1>📅 Session Updated</h1>
  </div>
  <div style="background:#fff; padding:30px; border-radius:0 0 8px 8px; border:1px solid #ddd;">
    <p>Hello <strong>${safe(facultyName)}</strong>,</p>
    <p>Your session has been updated with new details:</p>
    <table style="width:100%; border-collapse: collapse; margin:20px 0;">
      <tr style="background:#f8f9fa;">
        <td style="padding:12px; font-weight:bold; border-bottom:1px solid #ddd;">Title:</td>
        <td style="padding:12px; border-bottom:1px solid #ddd;">${safe(
          session.title
        )}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:12px; font-weight:bold; border-bottom:1px solid #ddd;">Start Time:</td>
        <td style="padding:12px; border-bottom:1px solid #ddd;">${formatDate(
          session.startTime
        )}</td>
      </tr>
      <tr style="background:#f8f9fa;">
        <td style="padding:12px; font-weight:bold; border-bottom:1px solid #ddd;">End Time:</td>
        <td style="padding:12px; border-bottom:1px solid #ddd;">${formatDate(
          session.endTime
        )}</td>
      </tr>
      <tr style="background:#fff;">
        <td style="padding:12px; font-weight:bold; border-bottom:1px solid #ddd;">Location:</td>
        <td style="padding:12px; border-bottom:1px solid #ddd;">${safe(
          session.place
        )} - ${safe(roomName)}</td>
      </tr>
      <tr style="background:#f8f9fa;">
        <td style="padding:12px; font-weight:bold;">Description:</td>
        <td style="padding:12px;">${safe(session.description)}</td>
      </tr>
    </table>
    <p><strong>Please confirm your availability again as the schedule has changed.</strong></p>
    <p style="text-align:center; margin:30px 0;">
      <a href="${loginUrl}" target="_blank" style="
        background:#ff6b35;
        color:#fff;
        padding:15px 25px;
        border-radius:25px;
        text-decoration:none;
        font-weight:bold;
        font-size:16px;
        box-shadow:0 4px 15px rgba(255,107,53,0.4);
        ">
        🔐 Confirm Availability
      </a>
    </p>
  </div>
</body>
</html>
`;
}

/**
 * Send multiple session invitations in one email
 */
export async function sendBulkInviteEmail(
  sessions: Session[],
  facultyName: string,
  email: string
) {
  if (!sessions?.length || !facultyName || !email) {
    return { ok: false, message: "Invalid arguments" };
  }

  const html = renderHTML(sessions, facultyName);
  const text = `Hello ${facultyName},

You have been invited to speak at ${sessions.length} session(s):

${sessions
  .map(
    (s) => `- ${safe(s.title)}
  Start: ${formatDate(s.startTime)}
  End: ${formatDate(s.endTime)}
  Location: ${safe(s.place)}`
  )
  .join("\n\n")}

Login here: ${baseUrl.replace(
    /\/+$/,
    ""
  )}/faculty-login?email=${encodeURIComponent(email)}
`;

  return sendMail({
    to: email,
    subject: `🎓 ${sessions.length} Session Invitation${
      sessions.length > 1 ? "s" : ""
    } - Please Login`,
    text,
    html,
  });
}

/**
 * Wrapper for sending a single session invite
 */
export async function sendInviteEmail(
  session: Session,
  facultyName: string,
  email: string
) {
  return sendBulkInviteEmail([session], facultyName, email);
}

/**
 * Send session update notification email
 */
export async function sendUpdateEmail(
  session: Session,
  facultyName: string,
  roomName: string
): Promise<{ ok: boolean; message?: string }> {
  if (!session || !facultyName || !session.email) {
    return { ok: false, message: "Invalid arguments for update email" };
  }

  try {
    const html = renderUpdateHTML(session, facultyName, roomName);
    const text = `Hello ${facultyName},

Your session "${safe(session.title)}" has been updated:

Start Time: ${formatDate(session.startTime)}
End Time: ${formatDate(session.endTime)}
Location: ${safe(session.place)} - ${safe(roomName)}
Description: ${safe(session.description)}

Please confirm your availability again as the schedule has changed.

Login here: ${baseUrl.replace(
      /\/+$/,
      ""
    )}/faculty-login?email=${encodeURIComponent(session.email)}
`;

    const result = await sendMail({
      to: session.email,
      subject: `📅 Session Updated: ${session.title}`,
      text,
      html,
    });

    return result;
  } catch (error) {
    console.error("Failed to send update email:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Email sending failed",
    };
  }
}
