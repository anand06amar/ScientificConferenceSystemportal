// // app/api/faculty/cv/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth/config";
// import { query } from "@/lib/database/connection";
// import { writeFile, mkdir, unlink } from "fs/promises";
// import { join } from "path";
// import { z } from "zod";

// // Validation schema
// const UploadSchema = z.object({
//   facultyId: z.string().min(1, "Faculty ID is required"),
//   sessionMetadataId: z.string().optional().nullable(),
// });

// // File validation
// function validateFile(file: File) {
//   const allowedTypes = [
//     "application/pdf",
//     "application/msword",
//     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//   ];
//   const maxSize = 10 * 1024 * 1024; // 10MB
//   if (!allowedTypes.includes(file.type)) return { valid: false, error: "Only PDF, DOC, DOCX allowed" };
//   if (file.size > maxSize) return { valid: false, error: "Max 10MB allowed" };
//   return { valid: true as const };
// }

// // Generate unique filename
// function generateUniqueFilename(originalName: string, facultyId: string) {
//   const ts = Date.now();
//   const rand = Math.random().toString(36).slice(2, 8);
//   const ext = originalName.split(".").pop();
//   return `${facultyId}_CV_${ts}_${rand}.${ext}`;
// }

// // POST /api/faculty/cv
// export async function POST(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const formData = await request.formData();
//     const file = formData.get("file") as File | null;
//     const facultyId = (formData.get("facultyId") as string | null) ?? "";
//     const sessionMetadataId = (formData.get("sessionId") as string | null) ?? null;

//     if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

//     UploadSchema.parse({ facultyId, sessionMetadataId });

//     // Permissions check
//     if (session.user.id !== facultyId && !["ORGANIZER", "EVENT_MANAGER"].includes(session.user.role)) {
//       return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
//     }

//     // Validate faculty exists
//     const facultyResult = await query("SELECT id, name, email FROM users WHERE id=$1 AND role=$2", [facultyId, "FACULTY"]);
//     if (!facultyResult.rows.length) return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
//     const faculty = facultyResult.rows[0];

//     // Validate file
//     const fv = validateFile(file);
//     if (!fv.valid) return NextResponse.json({ error: fv.error }, { status: 400 });

//     // Validate session metadata if provided
//     if (sessionMetadataId) {
//       const sessionRes = await query(
//         `SELECT id FROM session_metadata WHERE id=$1 AND faculty_id=$2 AND invite_status='Accepted'`,
//         [sessionMetadataId, facultyId]
//       );
//       if (!sessionRes.rows.length) {
//         return NextResponse.json({ error: "Invalid or unauthorized session for faculty" }, { status: 400 });
//       }
//     }

//     // Save file to disk
//     const uploadDir = join(process.cwd(), "public", "uploads", "cv");
//     await mkdir(uploadDir, { recursive: true });
//     const uniqueName = generateUniqueFilename(file.name, facultyId);
//     const absPath = join(uploadDir, uniqueName);
//     const buffer = Buffer.from(await file.arrayBuffer());
//     await writeFile(absPath, buffer);
//     const dbFilePath = `/uploads/cv/${uniqueName}`;

//     // Insert DB record
//     const insert = await query(
//       `INSERT INTO cv_uploads
//        (faculty_id, session_metadata_id, file_path, file_type, file_size, original_filename, uploaded_at)
//        VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
//       [facultyId, sessionMetadataId, dbFilePath, file.type, file.size, file.name]
//     );
//     const uploaded = insert.rows[0];

//     return NextResponse.json(
//       {
//         success: true,
//         message: "CV uploaded successfully",
//         data: {
//           id: uploaded.id,
//           fileName: uploaded.original_filename,
//           fileType: uploaded.file_type,
//           fileSize: uploaded.file_size,
//           filePath: uploaded.file_path,
//           uploadedAt: uploaded.uploaded_at,
//           faculty: { id: faculty.id, name: faculty.name, email: faculty.email },
//           sessionMetadataId: uploaded.session_metadata_id ?? null,
//         },
//       },
//       { status: 201 }
//     );
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       return NextResponse.json(
//         { error: "Validation failed", details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`) },
//         { status: 400 }
//       );
//     }
//     console.error("CV upload error:", error);
//     return NextResponse.json({ error: "Failed to upload CV" }, { status: 500 });
//   }
// }

// // GET /api/faculty/cv?facultyId=...&sessionId=...&limit=&offset=
// export async function GET(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { searchParams } = new URL(request.url);
//     const facultyId = searchParams.get("facultyId");
//     const sessionMetadataId = searchParams.get("sessionId");
//     const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
//     const offset = parseInt(searchParams.get("offset") || "0", 10);

//     const conditions: string[] = [];
//     const params: any[] = [];
//     let n = 0;

//     if (facultyId) { n++; conditions.push(`cv.faculty_id = $${n}`); params.push(facultyId); }
//     if (sessionMetadataId) { n++; conditions.push(`cv.session_metadata_id = $${n}`); params.push(sessionMetadataId); }

//     // Restrict regular faculty to their own
//     if (session.user.role === "FACULTY" && (!facultyId || facultyId !== session.user.id)) {
//       n++; conditions.push(`cv.faculty_id = $${n}`); params.push(session.user.id);
//     }

//     const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

//     const dataSql = `
//       SELECT cv.*, u.name AS faculty_name, u.email AS faculty_email,
//              sm.session_id, sm.place, sm.status AS session_status, sm.invite_status
//       FROM cv_uploads cv
//       JOIN users u ON u.id = cv.faculty_id
//       LEFT JOIN session_metadata sm ON sm.id = cv.session_metadata_id
//       ${where}
//       ORDER BY cv.uploaded_at DESC
//       LIMIT $${n + 1} OFFSET $${n + 2}
//     `;
//     params.push(limit, offset);

//     const rowsRes = await query(dataSql, params);

//     const countSql = `
//       SELECT COUNT(*)::int AS total
//       FROM cv_uploads cv
//       JOIN users u ON u.id = cv.faculty_id
//       LEFT JOIN session_metadata sm ON sm.id = cv.session_metadata_id
//       ${where}
//     `;
//     const countRes = await query(countSql, params.slice(0, -2));
//     const total = countRes.rows[0]?.total ?? 0;

//     return NextResponse.json({
//       success: true,
//       data: {
//         cvs: rowsRes.rows.map((r: any) => ({
//           id: r.id,
//           filePath: r.file_path,
//           fileType: r.file_type,
//           fileSize: r.file_size,
//           originalFilename: r.original_filename,
//           uploadedAt: r.uploaded_at,
//           faculty: { id: r.faculty_id, name: r.faculty_name, email: r.faculty_email },
//           session: r.session_metadata_id
//             ? {
//                 id: r.session_metadata_id,
//                 sessionId: r.session_id,
//                 place: r.place,
//                 status: r.session_status,
//                 inviteStatus: r.invite_status,
//               }
//             : null,
//         })),
//         pagination: { total, limit, offset, hasMore: offset + limit < total },
//       },
//     });
//   } catch (error) {
//     console.error("Get CVs error:", error);
//     return NextResponse.json({ error: "Failed to fetch CVs" }, { status: 500 });
//   }
// }

// // DELETE /api/faculty/cv?cvId=...
// export async function DELETE(request: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { searchParams } = new URL(request.url);
//     const cvId = searchParams.get("cvId");
//     if (!cvId) return NextResponse.json({ error: "CV ID is required" }, { status: 400 });

//     const found = await query("SELECT * FROM cv_uploads WHERE id=$1", [cvId]);
//     if (!found.rows.length) return NextResponse.json({ error: "CV not found" }, { status: 404 });
//     const cv = found.rows[0];

//     // Permissions
//     if (session.user.id !== cv.faculty_id && !["ORGANIZER", "EVENT_MANAGER"].includes(session.user.role)) {
//       return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
//     }

//     // Delete file from disk
//     const absPath = join(process.cwd(), "public", cv.file_path.replace(/^\/+/, ""));
//     try { await unlink(absPath); } catch (e) { console.warn("File deletion skipped:", e); }

//     await query("DELETE FROM cv_uploads WHERE id=$1", [cvId]);

//     return NextResponse.json({ success: true, message: "CV deleted successfully" });
//   } catch (error) {
//     console.error("Delete CV error:", error);
//     return NextResponse.json({ error: "Failed to delete CV" }, { status: 500 });
//   }
// }

// app/api/faculty/cv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { query } from "@/lib/database/connection";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";

// Validation schema
const UploadSchema = z.object({
  facultyId: z.string().min(1, "Faculty ID is required"),
  sessionMetadataId: z.string().optional().nullable(),
});

// Allowed CV types
const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const maxSize = 10 * 1024 * 1024; // 10MB

// Validate file
function validateFile(file: File) {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Only PDF, DOC, DOCX allowed" };
  }
  if (file.size > maxSize) {
    return { valid: false, error: "Max 10MB allowed" };
  }
  return { valid: true as const };
}

// Generate unique filename
function generateUniqueFilename(originalName: string, facultyId: string) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = originalName.split(".").pop();
  return `${facultyId}_CV_${ts}_${rand}.${ext}`;
}

// ✅ POST /api/faculty/cv
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const facultyId = (formData.get("facultyId") as string | null) ?? "";
    const sessionMetadataId = (formData.get("sessionId") as string | null) ?? null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate fields
    UploadSchema.parse({ facultyId, sessionMetadataId });

    // Permissions: faculty can only upload their own CV unless organizer/event_manager
    if (
      session.user.id !== facultyId &&
      !["ORGANIZER", "EVENT_MANAGER"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Validate faculty exists
    const facultyRes = await query(
      "SELECT id, name, email FROM users WHERE id=$1 AND role=$2",
      [facultyId, "FACULTY"]
    );
    if (!facultyRes.rows.length) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }
    const faculty = facultyRes.rows[0];

    // Validate file
    const fv = validateFile(file);
    if (fv.valid !== true) {
      return NextResponse.json({ error: fv.error }, { status: 400 });
    }

    // If sessionMetadataId provided → check ownership
    if (sessionMetadataId) {
      const sessionRes = await query(
        `SELECT id FROM session_metadata
         WHERE id = $1 AND faculty_id = $2 AND invite_status = 'Accepted'`,
        [sessionMetadataId, facultyId]
      );
      if (!sessionRes.rows.length) {
        return NextResponse.json(
          { error: "Invalid or unauthorized session for faculty" },
          { status: 400 }
        );
      }
    }

    // Save file to disk
    const uploadDir = join(process.cwd(), "public", "uploads", "cv");
    await mkdir(uploadDir, { recursive: true });

    const uniqueName = generateUniqueFilename(file.name, facultyId);
    const absPath = join(uploadDir, uniqueName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);

    const dbFilePath = `/uploads/cv/${uniqueName}`;

    // Insert record into DB
    const insert = await query(
      `INSERT INTO cv_uploads
        (faculty_id, session_metadata_id, file_path, file_type, file_size, original_filename, uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [facultyId, sessionMetadataId, dbFilePath, file.type, file.size, file.name]
    );
    const uploaded = insert.rows[0];

    return NextResponse.json(
      {
        success: true,
        message: "CV uploaded successfully",
        data: {
          id: uploaded.id,
          fileName: uploaded.original_filename,
          fileType: uploaded.file_type,
          fileSize: uploaded.file_size,
          filePath: uploaded.file_path,
          uploadedAt: uploaded.uploaded_at,
          faculty: { id: faculty.id, name: faculty.name, email: faculty.email },
          sessionMetadataId: uploaded.session_metadata_id ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        },
        { status: 400 }
      );
    }
    console.error("CV upload error:", error);
    return NextResponse.json({ error: "Failed to upload CV" }, { status: 500 });
  }
}
