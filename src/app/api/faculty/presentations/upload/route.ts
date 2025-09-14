// src/app/api/faculty/presentations/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { query } from '@/lib/database/connection';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
 
// Validation schema  
const UploadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  facultyId: z.string().min(1, 'Faculty ID is required'),
  sessionId: z.string().optional(),
});

// File validation function
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = [
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/pdf', // .pdf
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only PPT, PPTX, PDF, DOC, DOCX files are allowed.',
    };
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum file size is 50MB.',
    };
  }

  return { valid: true };
}

// Generate unique filename
function generateUniqueFilename(originalName: string, facultyId: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  return `${facultyId}_${timestamp}_${randomString}.${extension}`;
}

// Create a default event and session for faculty if needed
async function ensureEventAndSession(facultyId: string): Promise<string | null> {
  try {
    // First check if faculty has any event association
    const existingEventResult = await query(`
      SELECT e.id FROM events e
      JOIN user_events ue ON ue.event_id = e.id
      WHERE ue.user_id = $1
      LIMIT 1
    `, [facultyId]);

    let eventId: string;

    if (existingEventResult.rows.length > 0) {
      eventId = existingEventResult.rows[0].id;
    } else {
      // Create a default event for presentations
      const createEventResult = await query(`
        INSERT INTO events (
          name, description, start_date, end_date, location, status
        ) VALUES (
          'Faculty Presentations', 
          'Default event for faculty presentation uploads',
          NOW(),
          NOW() + INTERVAL '1 year',
          'Virtual',
          'ACTIVE'
        ) RETURNING id
      `, []);

      if (createEventResult.rows.length === 0) {
        return null;
      }

      eventId = createEventResult.rows[0].id;

      // Associate faculty with this event
      await query(`
        INSERT INTO user_events (user_id, event_id, role, created_at)
        VALUES ($1, $2, 'SPEAKER', NOW())
        ON CONFLICT (user_id, event_id) DO NOTHING
      `, [facultyId, eventId]);
    }

    // Now check if there's a session for presentations
    const existingSessionResult = await query(`
      SELECT id FROM conference_sessions
      WHERE event_id = $1 AND title = 'General Presentations'
      LIMIT 1
    `, [eventId]);

    if (existingSessionResult.rows.length > 0) {
      return existingSessionResult.rows[0].id;
    } else {
      // Create a default session
      const createSessionResult = await query(`
        INSERT INTO conference_sessions (
          event_id, title, description, start_time, end_time
        ) VALUES (
          $1,
          'General Presentations',
          'Default session for faculty presentations',
          NOW() + INTERVAL '1 day',
          NOW() + INTERVAL '1 day' + INTERVAL '2 hours'
        ) RETURNING id
      `, [eventId]);

      return createSessionResult.rows.length > 0 ? createSessionResult.rows[0].id : null;
    }

  } catch (error) {
    console.error('Error ensuring event and session:', error);
    return null;
  }
}

// POST - Upload presentation file
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const facultyId = formData.get('facultyId') as string;
    const sessionId = formData.get('sessionId') as string;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate form data
    const validatedData = UploadSchema.parse({
      title,
      facultyId,
      sessionId: sessionId && sessionId.trim() !== '' ? sessionId : undefined,
    });

    // Check permissions
    if (session.user.id !== facultyId && 
        !['ORGANIZER', 'EVENT_MANAGER'].includes(session.user.role || '')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate faculty exists
    const facultyResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1 AND role = $2',
      [facultyId, 'FACULTY']
    );

    if (facultyResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Faculty member not found' },
        { status: 404 }
      );
    }

    const faculty = facultyResult.rows[0];

    // Validate file
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    // Determine final session ID
    let finalSessionId = validatedData.sessionId;
    
    // If no session provided, try to create/find one
    if (!finalSessionId) {
      const ensuredSessionId = await ensureEventAndSession(facultyId);
      finalSessionId = ensuredSessionId === null ? undefined : ensuredSessionId;
    } else {
      // Validate provided session exists
      const sessionResult = await query(
        'SELECT id, title FROM conference_sessions WHERE id = $1',
        [finalSessionId]
      );

      if (sessionResult.rows.length === 0) {
        // Session doesn't exist, try to create default
        const ensuredSessionId = await ensureEventAndSession(facultyId);
        finalSessionId = ensuredSessionId === null ? undefined : ensuredSessionId;
      }
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.name, facultyId);
    
    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'presentations');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's okay
    }

    // Save file to disk
    const filePath = join(uploadDir, uniqueFilename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);

    // ✅ UPDATED: Save to database WITH file metadata
    const dbFilePath = `/uploads/presentations/${uniqueFilename}`;
    
    let insertQuery: string;
    let insertParams: any[];

    if (finalSessionId) {
      // Insert with session and file metadata
      insertQuery = `
        INSERT INTO presentations (
          user_id, 
          session_id, 
          title, 
          file_path,
          file_size,
          file_type,
          original_filename,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;
      insertParams = [facultyId, finalSessionId, validatedData.title, dbFilePath, file.size, file.type, file.name];
    } else {
      // Insert without session but with file metadata
      insertQuery = `
        INSERT INTO presentations (
          user_id, 
          session_id, 
          title, 
          file_path,
          file_size,
          file_type,
          original_filename,
          uploaded_at
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      insertParams = [facultyId, validatedData.title, dbFilePath, file.size, file.type, file.name];
    }

    const insertResult = await query(insertQuery, insertParams);
    const presentation = insertResult.rows[0];

    // Log the activity (if activity_logs table exists)
    try {
      await query(
        `INSERT INTO activity_logs (
          user_id, action, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          session.user.id,
          'PRESENTATION_UPLOAD',
          `Uploaded presentation: ${validatedData.title}`,
          JSON.stringify({
            presentationId: presentation.id,
            facultyId: facultyId,
            filename: file.name,
            fileSize: file.size,
            fileType: file.type,
            sessionId: finalSessionId
          })
        ]
      );
    } catch (logError) {
      // If activity_logs doesn't exist, just continue
      console.log('Activity logging skipped:', logError);
    }

    // ✅ UPDATED: Return success response with complete metadata
    return NextResponse.json({
      success: true,
      message: 'Presentation uploaded successfully',
      data: {
        id: presentation.id,
        title: presentation.title,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        originalFilename: file.name,
        filePath: dbFilePath,
        uploadedAt: presentation.uploaded_at,
        sessionId: finalSessionId,
        faculty: {
          id: faculty.id,
          name: faculty.name,
          email: faculty.email
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Presentation upload error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    // Handle database errors
    if (error instanceof Error && error.message.includes('foreign key')) {
      return NextResponse.json(
        { error: 'Database reference error. Please contact support.' },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Failed to upload presentation. Please try again.' },
      { status: 500 }
    );
  }
}

// ✅ UPDATED: GET - List faculty presentations with file metadata
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get('facultyId');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query conditions
    const conditions = [];
    const params = [];
    let paramCount = 0;

    if (facultyId) {
      paramCount++;
      conditions.push(`p.user_id = $${paramCount}`);
      params.push(facultyId);
    }

    if (sessionId) {
      paramCount++;
      conditions.push(`p.session_id = $${paramCount}`);
      params.push(sessionId);
    }

    // Check permissions
    if (session.user.role === 'FACULTY') {
      // Faculty can only see their own presentations
      if (!facultyId || facultyId !== session.user.id) {
        paramCount++;
        conditions.push(`p.user_id = $${paramCount}`);
        params.push(session.user.id);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ✅ UPDATED: Get presentations with file metadata
    const presentationsQuery = `
      SELECT 
        p.*,
        u.name as faculty_name,
        u.email as faculty_email,
        u.institution,
        cs.title as session_title,
        cs.start_time as session_start_time
      FROM presentations p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN conference_sessions cs ON cs.id = p.session_id
      ${whereClause}
      ORDER BY p.uploaded_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);
    const result = await query(presentationsQuery, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM presentations p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN conference_sessions cs ON cs.id = p.session_id
      ${whereClause}
    `;

    const countResult = await query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Helper function to get file info from filesystem (fallback if DB doesn't have metadata)
    const getFileInfoFromFilesystem = async (filePath: string) => {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const fullPath = path.join(process.cwd(), 'public', filePath);
        const stats = await fs.stat(fullPath);
        const filename = path.basename(filePath);
        
        // Extract file type from extension
        const extension = filename.split('.').pop()?.toLowerCase();
        let fileType = 'Unknown';
        
        switch (extension) {
          case 'pdf':
            fileType = 'application/pdf';
            break;
          case 'ppt':
            fileType = 'application/vnd.ms-powerpoint';
            break;
          case 'pptx':
            fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            break;
          case 'doc':
            fileType = 'application/msword';
            break;
          case 'docx':
            fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            break;
        }
        
        return {
          fileSize: stats.size,
          fileType: fileType,
          originalFilename: filename
        };
      } catch (error) {
        console.error('Error getting file info:', error);
        return {
          fileSize: 0,
          fileType: 'Unknown',
          originalFilename: 'Unknown'
        };
      }
    };

    // ✅ UPDATED: Process results and ensure complete file metadata
    const presentationsWithMetadata = await Promise.all(
      result.rows.map(async (row) => {
        let fileSize = row.file_size;
        let fileType = row.file_type;
        let originalFilename = row.original_filename;

        // If database doesn't have complete metadata, get it from filesystem
        if (!fileSize || !fileType || !originalFilename) {
          const fileInfo = await getFileInfoFromFilesystem(row.file_path);
          fileSize = fileSize || fileInfo.fileSize;
          fileType = fileType || fileInfo.fileType;
          originalFilename = originalFilename || fileInfo.originalFilename;
        }
        
        return {
          id: row.id,
          title: row.title,
          filePath: row.file_path,
          fileSize: fileSize,              // ✅ Now included
          fileType: fileType,              // ✅ Now included
          originalFilename: originalFilename, // ✅ Now included
          uploadedAt: row.uploaded_at,
          faculty: {
            id: row.user_id,
            name: row.faculty_name,
            email: row.faculty_email,
            institution: row.institution
          },
          session: row.session_id ? {
            id: row.session_id,
            title: row.session_title,
            startTime: row.session_start_time
          } : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        presentations: presentationsWithMetadata,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Get presentations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch presentations' },
      { status: 500 }
    );
  }
}

// ✅ UPDATED: DELETE - Delete presentation
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileId, facultyId } = body;

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Check permissions
    if (session.user.role === 'FACULTY' && session.user.id !== facultyId) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get presentation details first
    const presentationResult = await query(
      'SELECT * FROM presentations WHERE id = $1',
      [fileId]
    );

    if (presentationResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Presentation not found' },
        { status: 404 }
      );
    }

    const presentation = presentationResult.rows[0];

    // Additional permission check
    if (session.user.role === 'FACULTY' && presentation.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete another faculty\'s presentation' },
        { status: 403 }
      );
    }

    // Delete file from filesystem
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const fullPath = path.join(process.cwd(), 'public', presentation.file_path);
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.error('Error deleting file from filesystem:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    const deleteResult = await query(
      'DELETE FROM presentations WHERE id = $1 RETURNING *',
      [fileId]
    );

    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete presentation' },
        { status: 500 }
      );
    }

    // Log the activity
    try {
      await query(
        `INSERT INTO activity_logs (
          user_id, action, description, metadata, created_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [
          session.user.id,
          'PRESENTATION_DELETE',
          `Deleted presentation: ${presentation.title}`,
          JSON.stringify({
            presentationId: fileId,
            facultyId: presentation.user_id,
            filename: presentation.original_filename || 'Unknown'
          })
        ]
      );
    } catch (logError) {
      console.log('Activity logging skipped:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'Presentation deleted successfully'
    });

  } catch (error) {
    console.error('Delete presentation error:', error);
    return NextResponse.json(
      { error: 'Failed to delete presentation' },
      { status: 500 }
    );
  }
}
