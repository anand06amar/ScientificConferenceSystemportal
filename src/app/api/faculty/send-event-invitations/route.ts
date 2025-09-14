import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    const { event, template, invitations } = await req.json();

    if (!invitations || !Array.isArray(invitations) || !event) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const sentInvitations = [];
    const failedInvitations = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    console.log(
      `📨 Starting REAL email campaign for ${invitations.length} faculty members`
    );

    for (const invitation of invitations) {
      try {
        // Generate unique faculty login link with event context
        const loginParams = new URLSearchParams({
          email: invitation.email,
          ref: "event-invitation",
          eventId: event.id,
          invitationId: invitation.id,
        });

        const facultyLoginLink = `${baseUrl}/faculty-login?${loginParams.toString()}`;

        // Format event dates
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        const eventDates = `${startDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })} - ${endDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`;

        // Replace placeholders in email template
        let personalizedMessage = template.message
          .replace(/\{\{facultyName\}\}/g, invitation.name)
          .replace(/\{\{eventDates\}\}/g, eventDates)
          .replace(/\{\{eventLocation\}\}/g, event.location)
          .replace(/\{\{eventVenue\}\}/g, event.venue)
          .replace(/\{\{eventDescription\}\}/g, event.description);

        // Create text version
        const emailText = `${personalizedMessage}

ACCESS YOUR FACULTY PORTAL:
${facultyLoginLink}

EVENT INFORMATION:
Event: ${event.title}
Location: ${event.location}
Venue: ${event.venue}
Dates: ${eventDates}

NEXT STEPS:
1. Click the link above to access your faculty portal
2. Sign in with your Google account
3. Review the complete event details
4. Confirm your participation

We look forward to your positive response!

---
This invitation was sent by the Conference Management System
If you have any questions, please contact our support team.`;

        // Create HTML version
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Invitation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎓 Event Invitation</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${event.title}</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <p style="font-size: 16px; margin-bottom: 15px;">Dear <strong style="color: #4299e1;">${invitation.name}</strong>,</p>
        
        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4299e1;">
            <div style="white-space: pre-line; color: #4a5568; line-height: 1.7;">
                ${personalizedMessage}
            </div>
        </div>

        <!-- Event Details Card -->
        <div style="background: #edf2f7; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📋 Event Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #4a5568;">
                        <strong style="color: #2d3748;">📅 Event:</strong><br>
                        ${event.title}
                    </td>
                    <td style="padding: 8px 0; color: #4a5568;">
                        <strong style="color: #2d3748;">📆 Dates:</strong><br>
                        ${eventDates}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #4a5568;">
                        <strong style="color: #2d3748;">📍 Location:</strong><br>
                        ${event.location}
                    </td>
                    <td style="padding: 8px 0; color: #4a5568;">
                        <strong style="color: #2d3748;">🏢 Venue:</strong><br>
                        ${event.venue}
                    </td>
                </tr>
            </table>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${facultyLoginLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                      font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                🔐 Access Faculty Portal & Respond
            </a>
        </div>

        <!-- Next Steps -->
        <div style="background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 6px; padding: 15px; margin: 25px 0;">
            <h4 style="color: #22543d; margin: 0 0 10px 0; font-size: 14px;">✅ Your Next Steps:</h4>
            <ol style="color: #2f855a; margin: 0; padding-left: 20px; line-height: 1.4; font-size: 14px;">
                <li>Click the link above to access your personalized faculty portal</li>
                <li>Sign in securely with your Google account</li>
                <li>Review the complete event details and agenda</li>
                <li>Confirm your participation by accepting the invitation</li>
            </ol>
        </div>

        <p style="color: #718096; font-size: 13px; text-align: center; margin-top: 25px; line-height: 1.4;">
            We are excited about the possibility of having you join us for this prestigious event.<br>
            Your expertise would be invaluable to our academic community.
        </p>
    </div>

    <!-- Footer -->
    <div style="background: #2d3748; color: #e2e8f0; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin-top: 10px;">
        <p style="margin: 0 0 8px 0; font-size: 13px;">
            📧 This invitation was sent by the Conference Management System
        </p>
        <p style="margin: 0; font-size: 11px; opacity: 0.8;">
            Need assistance? Contact our support team • © 2025 Academic Conference
        </p>
    </div>
</body>
</html>`;

        // Send the actual email using nodemailer
        const emailResult = await sendMail({
          to: invitation.email,
          subject: `${template.subject} - Personal Invitation for ${invitation.name}`,
          text: emailText,
          html: emailHtml,
        });

        if (emailResult.ok) {
          sentInvitations.push({
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            eventId: event.id,
            loginLink: facultyLoginLink,
            sentAt: new Date().toISOString(),
            // messageId: emailResult.messageId,
          });

          console.log(
            `✅ REAL email sent to: ${invitation.email} (${invitation.name})`
          );
        } else {
          failedInvitations.push({
            email: invitation.email,
            error: emailResult.error || "Email delivery failed",
          });
          console.log(
            `❌ Failed to send email to: ${invitation.email} - ${emailResult.error}`
          );
        }
      } catch (error) {
        console.error(
          `Failed to process invitation for ${invitation.email}:`,
          error
        );
        failedInvitations.push({
          email: invitation.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Add small delay between emails to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Log campaign summary
    console.log(`📊 REAL Email Campaign Complete:`, {
      eventTitle: event.title,
      totalInvitations: invitations.length,
      successCount: sentInvitations.length,
      failedCount: failedInvitations.length,
      successRate: `${(
        (sentInvitations.length / invitations.length) *
        100
      ).toFixed(1)}%`,
    });

    return NextResponse.json({
      success: true,
      data: {
        sentCount: sentInvitations.length,
        failedCount: failedInvitations.length,
        sentInvitations,
        failedInvitations,
        eventDetails: {
          title: event.title,
          location: event.location,
          dates: `${new Date(
            event.startDate
          ).toLocaleDateString()} - ${new Date(
            event.endDate
          ).toLocaleDateString()}`,
        },
      },
      message: `Successfully sent ${sentInvitations.length} REAL email invitations`,
    });
  } catch (error) {
    console.error("❌ Error in REAL email campaign:", error);
    return NextResponse.json(
      { error: "Failed to send event invitations" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
