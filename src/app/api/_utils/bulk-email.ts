// src/app/api/_utils/bulk-email.ts
import nodemailer from "nodemailer";

interface BulkInviteParams {
  facultyEmail: string;
  facultyName: string;
  sessions: any[];
  eventId: string;
}

export async function sendBulkInviteEmail({
  facultyEmail,
  facultyName,
  sessions,
  eventId,
}: BulkInviteParams) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const sessionsList = sessions
      .map(
        (session, index) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin: 12px 0; padding: 16px; background: #f8fafc;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b;">Session ${index + 1}: ${
          session.title
        }</h4>
        <p style="margin: 4px 0; color: #64748b;"><strong>Date:</strong> ${new Date(
          session.startTime
        ).toLocaleDateString()}</p>
        <p style="margin: 4px 0; color: #64748b;"><strong>Time:</strong> 9:00 AM - 5:00 PM (Draft timing - to be coordinated)</p>
        <p style="margin: 4px 0; color: #64748b;"><strong>Location:</strong> ${
          session.place
        }</p>
        <p style="margin: 4px 0; color: #64748b;"><strong>Room:</strong> ${
          session.roomName || session.roomId
        }</p>
        ${
          session.description
            ? `<p style="margin: 8px 0 0 0; color: #475569;"><em>${session.description}</em></p>`
            : ""
        }
      </div>
    `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Session Invitations</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Session Invitations</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">You're invited to participate in multiple sessions</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <p style="font-size: 18px; margin-bottom: 20px;">Dear ${facultyName},</p>
          
          <p style="margin-bottom: 20px;">
            We are pleased to invite you to participate in <strong>${
              sessions.length
            } session(s)</strong> for our upcoming event. 
            Below are the details of your sessions:
          </p>
          
          <div style="margin: 24px 0;">
            ${sessionsList}
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;"><strong>Note:</strong> Times shown are draft placeholders. We will coordinate exact timing with you after confirmation.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${
              process.env.NEXT_PUBLIC_BASE_URL
            }/faculty/respond?email=${encodeURIComponent(
      facultyEmail
    )}&eventId=${eventId}" 
               style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Review & Respond to All Sessions
            </a>
          </div>
          
          <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
            This email contains invitations for ${
              sessions.length
            } sessions. You can respond to each session individually through the link above.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #64748b; font-size: 12px; text-align: center;">
            This is an automated invitation. Please do not reply to this email directly.
          </p>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: facultyEmail,
      subject: `Session Invitations - ${sessions.length} Sessions Scheduled`,
      html: htmlContent,
    });

    console.log(`✅ Bulk invitation sent successfully to ${facultyEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error sending bulk invitation:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}
