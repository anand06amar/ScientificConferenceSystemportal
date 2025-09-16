"use client";

import React, { useEffect, useState, useCallback } from "react";
import { OrganizerLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  Users,
  MapPin,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
  Settings,
  Mail,
  FileSpreadsheet,
  Download,
  Send,
  Sparkles,
} from "lucide-react";
import * as XLSX from "xlsx";

// Types
type Faculty = {
  id: string;
  name: string;
  email?: string;
  eventName?: string;
  eventId: string;
  department?: string;
  institution?: string;
  expertise?: string;
  phone?: string;
};

type Room = { id: string; name: string };

type Event = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
  status: string;
  description?: string;
  eventType?: string;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  };
  _count?: {
    sessions: number;
    registrations: number;
  };
  facultyCount?: number;
};

type ExcelSessionData = {
  id: string;
  facultyName: string;
  email: string;
  place: string;
  sessionTitle: string;
  date: string;
  role: string; // Goes into description
  roomId?: string;
  status: "Draft" | "Confirmed";
};

const ExcelSessionCreator: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedSessions, setParsedSessions] = useState<ExcelSessionData[]>([]);
  const [formStep, setFormStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [createdSessions, setCreatedSessions] = useState<any[]>([]);

  // Load events and rooms
  const loadEventsAndRooms = useCallback(async () => {
    try {
      const [eventsResponse, roomsResponse] = await Promise.all([
        fetch("/api/events", { cache: "no-store" }),
        fetch("/api/rooms", { cache: "no-store" }),
      ]);

      let eventsList: Event[] = [];
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        if (eventsData.success && eventsData.data?.events) {
          eventsList = eventsData.data.events;
        } else if (Array.isArray(eventsData)) {
          eventsList = eventsData;
        }
      }

      const roomsList = roomsResponse.ok ? await roomsResponse.json() : [];

      setEvents(eventsList);
      setRooms(roomsList);
    } catch (error) {
      console.error("Error loading data:", error);
      setErrorMessage("Failed to load events or rooms.");
    }
  }, []);

  useEffect(() => {
    loadEventsAndRooms();
  }, [loadEventsAndRooms]);

  // Handle Excel file upload and parsing
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Excel file size should be less than 10MB");
      return;
    }

    setExcelFile(file);
    parseExcelFile(file);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // ✅ FIXED: Safe access to sheet name with proper validation
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("No worksheets found in Excel file");
        }

        const sheetName = workbook.SheetNames[0];

        // ✅ FIXED: Check if sheetName exists before using as index
        if (!sheetName) {
          throw new Error("Invalid worksheet name");
        }

        // ✅ FIXED: Safe worksheet access
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error("Worksheet not found");
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log("Parsed Excel data:", jsonData);

        // ✅ FIXED: Safe mapping with proper type checking
        const sessions: ExcelSessionData[] = jsonData.map(
          (row: any, index: number) => {
            // ✅ Safe property access with fallbacks
            const facultyName = row["Faculty Name"] || row["Name"] || "";
            const email = row["Email"] || row["Email ID"] || "";
            const place = row["Place"] || row["Location"] || "";
            const sessionTitle = row["Session Title"] || row["Title"] || "";
            const date = row["Date"] || "";
            const role = row["Role"] || row["Description"] || "";

            return {
              id: `excel-session-${index}`,
              facultyName,
              email,
              place,
              sessionTitle,
              date,
              role,
              roomId: "",
              status: "Draft" as const,
            };
          }
        );

        // Validate required fields
        const invalidSessions = sessions.filter(
          (s) => !s.facultyName || !s.email || !s.sessionTitle || !s.date
        );

        if (invalidSessions.length > 0) {
          setErrorMessage(
            `${invalidSessions.length} rows have missing required fields (Faculty Name, Email, Session Title, Date)`
          );
          return;
        }

        setParsedSessions(sessions);
        setErrorMessage("");
        console.log(
          `Successfully parsed ${sessions.length} sessions from Excel`
        );
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        setErrorMessage("Failed to parse Excel file. Please check the format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Update session data
  const updateSession = (
    sessionId: string,
    field: keyof ExcelSessionData,
    value: string
  ) => {
    setParsedSessions((sessions) =>
      sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session
      )
    );
  };

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!selectedEventId) {
      errors.selectedEventId = "Please select an event";
    }

    if (parsedSessions.length === 0) {
      errors.excelFile = "Please upload and parse an Excel file";
    }

    // Validate each session
    parsedSessions.forEach((session, index) => {
      if (!session.facultyName.trim()) {
        errors[`${session.id}-name`] = "Faculty name is required";
      }
      if (!session.email.trim() || !session.email.includes("@")) {
        errors[`${session.id}-email`] = "Valid email is required";
      }
      if (!session.sessionTitle.trim()) {
        errors[`${session.id}-title`] = "Session title is required";
      }
      if (!session.date) {
        errors[`${session.id}-date`] = "Date is required";
      }
      if (!session.roomId) {
        errors[`${session.id}-room`] = "Room is required";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create all sessions
  const handleCreateSessions = async () => {
    if (!validateForm()) {
      setErrorMessage("Please fix all validation errors before proceeding.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const createdSessionsList = [];

      for (const [index, session] of parsedSessions.entries()) {
        console.log(
          `Creating session ${index + 1}/${parsedSessions.length}: ${
            session.sessionTitle
          }`
        );

        const formData = new FormData();
        formData.append("title", session.sessionTitle.trim());
        formData.append("facultyId", `excel-faculty-${session.email}`); // Generate temporary faculty ID
        formData.append("email", session.email.trim());
        formData.append("place", session.place.trim());
        // formData.append("roomId", session.roomId);
        formData.append("description", session.role.trim());
        formData.append("status", session.status);
        formData.append("eventId", selectedEventId);
        formData.append("invite_status", "Pending");

        // Format date to IST timestamp
        const sessionDate = new Date(session.date);
        const startTime = `${sessionDate.toISOString().split("T")[0]}T09:00:00`;
        const endTime = `${sessionDate.toISOString().split("T")[0]}T17:00:00`;

        formData.append("suggested_time_start", startTime);
        formData.append("suggested_time_end", endTime);

        const response = await fetch("/api/sessions", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const responseData = await response.json();
          createdSessionsList.push({
            ...responseData.data,
            facultyName: session.facultyName,
            originalEmail: session.email,
          });
          console.log(`Session created successfully: ${session.sessionTitle}`);
        } else {
          const errorData = await response.json();
          console.error(
            `Session creation error for "${session.sessionTitle}":`,
            errorData
          );
          throw new Error(
            errorData.error ||
              `Failed to create session: ${session.sessionTitle}`
          );
        }
      }

      setCreatedSessions(createdSessionsList);
      setSuccessMessage(
        `Successfully created ${createdSessionsList.length} sessions from Excel file!`
      );
      setFormStep(3); // Move to email sending step
    } catch (error) {
      console.error("Error creating sessions:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An error occurred while creating sessions"
      );
    } finally {
      setLoading(false);
    }
  };

  // Send bulk invitations
  const handleSendInvitations = async () => {
    if (createdSessions.length === 0) {
      setErrorMessage("No sessions created yet. Please create sessions first.");
      return;
    }

    setEmailSending(true);
    setErrorMessage("");

    try {
      console.log("Sending bulk invitation emails...");

      // Group sessions by faculty email
      const sessionsByEmail: Record<string, any[]> = {};
      createdSessions.forEach((session) => {
        const email = session.originalEmail || session.email;
        if (!sessionsByEmail[email]) {
          sessionsByEmail[email] = [];
        }
        sessionsByEmail[email].push(session);
      });

      let successfulEmails = 0;
      const failedEmails: string[] = [];

      for (const [email, sessions] of Object.entries(sessionsByEmail)) {
        try {
          const emailResponse = await fetch("/api/sessions/bulk-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              sessions,
              eventId: selectedEventId,
              facultyName: sessions[0]?.facultyName || "Faculty Member",
            }),
          });

          if (emailResponse.ok) {
            successfulEmails++;
            console.log(`Bulk invitation sent to: ${email}`);
          } else {
            const emailError = await emailResponse.json();
            console.warn(`Email failed for ${email}:`, emailError);
            failedEmails.push(email);
          }
        } catch (emailError) {
          console.warn(`Email error for ${email}:`, emailError);
          failedEmails.push(email);
        }
      }

      const totalFaculty = Object.keys(sessionsByEmail).length;

      if (successfulEmails === totalFaculty) {
        setSuccessMessage(
          `🎉 All invitation emails sent successfully to ${successfulEmails} faculty members!`
        );
      } else {
        setSuccessMessage(
          `Invitation emails sent to ${successfulEmails}/${totalFaculty} faculty members. ${failedEmails.length} failed.`
        );
        if (failedEmails.length > 0) {
          setErrorMessage(
            `Failed to send emails to: ${failedEmails.join(", ")}`
          );
        }
      }
    } catch (error) {
      console.error("Error sending bulk invitations:", error);
      setErrorMessage("Failed to send invitation emails. Please try again.");
    } finally {
      setEmailSending(false);
    }
  };

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Faculty Name": "Dr. John Smith",
        Email: "john.smith@university.edu",
        Place: "Main Campus",
        "Session Title": "Introduction to AI",
        Date: "2024-09-20",
        Role: "Keynote Speaker - Artificial Intelligence Expert",
      },
      {
        "Faculty Name": "Prof. Jane Doe",
        Email: "jane.doe@university.edu",
        Place: "Science Building",
        "Session Title": "Data Science Workshop",
        Date: "2024-09-21",
        Role: "Workshop Facilitator - Data Science Department",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sessions");
    XLSX.writeFile(workbook, "session_template.xlsx");
  };

  const resetForm = () => {
    setSelectedEventId("");
    setExcelFile(null);
    setParsedSessions([]);
    setCreatedSessions([]);
    setFormStep(1);
    setValidationErrors({});
    setSuccessMessage("");
    setErrorMessage("");
  };

  const nextStep = () => {
    if (formStep === 1) {
      if (!selectedEventId) {
        setValidationErrors({ selectedEventId: "Please select an event" });
        return;
      }
      if (parsedSessions.length === 0) {
        setValidationErrors({
          excelFile: "Please upload and parse an Excel file",
        });
        return;
      }
    }
    setFormStep(formStep + 1);
  };

  const prevStep = () => {
    setFormStep(formStep - 1);
  };

  return (
    <OrganizerLayout>
      <div className="min-h-screen bg-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-lg">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-emerald-200 to-blue-200 bg-clip-text text-transparent">
                  Excel-Based Session Creator
                </h1>
                <p className="text-gray-300 text-lg mt-1">
                  Upload Excel file to create multiple sessions automatically
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4 mb-8">
              {[
                { step: 1, title: "Event & Excel Upload", icon: Upload },
                { step: 2, title: "Review & Create Sessions", icon: Eye },
                { step: 3, title: "Send Invitations", icon: Send },
              ].map(({ step, title, icon: Icon }) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                      formStep >= step
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-lg"
                        : "bg-gray-800 border-gray-600 text-gray-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{title}</span>
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-8 h-0.5 mx-2 ${
                        formStep > step ? "bg-emerald-500" : "bg-gray-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <Alert className="mb-6 border-green-600 bg-green-900/20 backdrop-blur">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200 font-medium">
                {successMessage}
              </AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert className="mb-6 border-red-600 bg-red-900/20 backdrop-blur">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200 font-medium">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="border-gray-700 shadow-2xl bg-gray-900/80 backdrop-blur">
                <CardHeader className="border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-800/50">
                  <CardTitle className="flex items-center gap-3 text-xl text-white">
                    <div className="p-2 rounded-lg bg-emerald-600/20">
                      <Settings className="h-5 w-5 text-emerald-400" />
                    </div>
                    {formStep === 1 && "Event Selection & Excel Upload"}
                    {formStep === 2 && "Review & Create Sessions"}
                    {formStep === 3 && "Send Invitations"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 text-white">
                  {/* Step 1: Event & Excel Upload */}
                  {formStep === 1 && (
                    <div className="space-y-6">
                      {/* Event Selection */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-200 mb-2">
                          <Calendar className="h-4 w-4 inline mr-2" />
                          Select Event *
                          <span className="text-xs text-emerald-400 ml-2">
                            ({events.length} events available)
                          </span>
                        </label>
                        <select
                          value={selectedEventId}
                          onChange={(e) => {
                            setSelectedEventId(e.target.value);
                            if (validationErrors.selectedEventId) {
                              setValidationErrors((prev) => ({
                                ...prev,
                                selectedEventId: "",
                              }));
                            }
                          }}
                          className={`w-full p-4 border-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-800 text-white ${
                            validationErrors.selectedEventId
                              ? "border-red-500 bg-red-900/20"
                              : "border-gray-600 hover:border-gray-500 focus:border-emerald-400"
                          }`}
                          required
                        >
                          <option value="">Choose Event</option>
                          {events.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.name}
                            </option>
                          ))}
                        </select>
                        {validationErrors.selectedEventId && (
                          <p className="text-red-400 text-sm mt-1">
                            {validationErrors.selectedEventId}
                          </p>
                        )}
                      </div>

                      {/* Excel Template Download */}
                      <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center gap-2">
                          <Download className="h-5 w-5" />
                          Excel Template
                        </h3>
                        <p className="text-blue-300 text-sm mb-4">
                          Download the template to see the required format for
                          your Excel file.
                        </p>
                        <Button
                          type="button"
                          onClick={downloadTemplate}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </div>

                      {/* Excel File Upload */}
                      <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 hover:border-emerald-400 transition-all bg-gray-800/50">
                        <div className="text-center">
                          <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <h3 className="text-lg font-semibold text-white mb-2">
                            Upload Excel File
                          </h3>
                          <p className="text-gray-300 mb-4">
                            Upload Excel file with faculty and session details
                          </p>

                          {!excelFile ? (
                            <div>
                              <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleExcelUpload}
                                className="hidden"
                                id="excel-upload"
                              />
                              <label
                                htmlFor="excel-upload"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 cursor-pointer transition-all shadow-lg"
                              >
                                <Upload className="h-4 w-4" />
                                Choose Excel File
                              </label>
                              <p className="text-xs text-gray-400 mt-2">
                                .xlsx, .xls up to 10MB
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-center gap-3">
                                <Badge className="bg-emerald-800 text-emerald-200 border-emerald-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {excelFile.name}
                                </Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setExcelFile(null);
                                    setParsedSessions([]);
                                  }}
                                  className="border-red-600 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              </div>
                              {parsedSessions.length > 0 && (
                                <div className="text-emerald-300">
                                  ✅ Parsed {parsedSessions.length} sessions
                                  successfully!
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Required Excel Columns */}
                      <div className="bg-yellow-900/20 border border-yellow-600 rounded-xl p-4">
                        <h4 className="text-yellow-200 font-medium mb-2">
                          Required Excel Columns:
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {[
                            "Faculty Name",
                            "Email",
                            "Place",
                            "Session Title",
                            "Date",
                            "Role",
                          ].map((col) => (
                            <div key={col} className="text-yellow-300">
                              • {col}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Review & Create Sessions */}
                  {formStep === 2 && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          Review Sessions ({parsedSessions.length})
                        </h3>
                        <Badge className="bg-emerald-800 text-emerald-200">
                          Event:{" "}
                          {events.find((e) => e.id === selectedEventId)?.name}
                        </Badge>
                      </div>

                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {parsedSessions.map((session, index) => (
                          <Card
                            key={session.id}
                            className="border-gray-600 bg-gray-800/50"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-white text-base flex items-center gap-2">
                                  <Badge
                                    variant="secondary"
                                    className="bg-emerald-900/50 text-emerald-200"
                                  >
                                    #{index + 1}
                                  </Badge>
                                  {session.sessionTitle}
                                </CardTitle>
                                <div className="text-xs text-gray-400">
                                  {session.date}
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-400">
                                    Faculty:
                                  </span>
                                  <span className="text-white ml-2">
                                    {session.facultyName}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Email:</span>
                                  <span className="text-white ml-2">
                                    {session.email}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Place:</span>
                                  <span className="text-white ml-2">
                                    {session.place}
                                  </span>
                                </div>
                                <div>
                                  <label className="text-gray-400">Room:</label>
                                  <select
                                    value={session.roomId}
                                    onChange={(e) =>
                                      updateSession(
                                        session.id,
                                        "roomId",
                                        e.target.value
                                      )
                                    }
                                    className={`ml-2 p-1 text-xs rounded bg-gray-700 text-white border ${
                                      validationErrors[`${session.id}-room`]
                                        ? "border-red-500"
                                        : "border-gray-600"
                                    }`}
                                  >
                                    <option value="">Select Room</option>
                                    {rooms.map((room) => (
                                      <option key={room.id} value={room.id}>
                                        {room.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {session.role && (
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                  <span className="text-gray-400 text-sm">
                                    Role/Description:
                                  </span>
                                  <p className="text-white text-sm mt-1">
                                    {session.role}
                                  </p>
                                </div>
                              )}
                              {validationErrors[`${session.id}-room`] && (
                                <p className="text-red-400 text-xs">
                                  {validationErrors[`${session.id}-room`]}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-emerald-200">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">
                            Ready to create {parsedSessions.length} sessions
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Send Invitations */}
                  {formStep === 3 && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-gray-800 to-gray-800/50 rounded-xl p-6 border border-gray-700">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          Invitation Summary
                        </h3>

                        <div className="grid md:grid-cols-2 gap-4 text-sm mb-6">
                          <div>
                            <span className="font-medium text-gray-300">
                              Event:
                            </span>
                            <p className="text-white">
                              {
                                events.find((e) => e.id === selectedEventId)
                                  ?.name
                              }
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">
                              Total Sessions:
                            </span>
                            <p className="text-white">
                              {createdSessions.length}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">
                              Unique Faculty:
                            </span>
                            <p className="text-white">
                              {
                                new Set(
                                  createdSessions.map(
                                    (s) => s.originalEmail || s.email
                                  )
                                ).size
                              }
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-300">
                              Status:
                            </span>
                            <p className="text-emerald-300">
                              Sessions Created ✓
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-300">
                            Faculty List:
                          </h4>
                          <div className="max-h-40 overflow-y-auto space-y-2">
                            {Array.from(
                              new Set(
                                createdSessions.map(
                                  (s) => s.originalEmail || s.email
                                )
                              )
                            ).map((email) => {
                              const facultySessions = createdSessions.filter(
                                (s) => (s.originalEmail || s.email) === email
                              );
                              return (
                                <div
                                  key={email}
                                  className="flex justify-between items-center text-sm bg-gray-800/50 rounded p-2"
                                >
                                  <div>
                                    <span className="text-white">
                                      {facultySessions[0]?.facultyName}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      ({email})
                                    </span>
                                  </div>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {facultySessions.length} sessions
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <Alert className="border-emerald-600 bg-emerald-900/20">
                        <Send className="h-4 w-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-200">
                          <strong>Ready to send invitations!</strong>
                          <br />
                          Individual emails will be sent to each faculty member
                          with their respective session details.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between items-center pt-8 border-t border-gray-700">
                    <div>
                      {formStep > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={prevStep}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                        >
                          Previous Step
                        </Button>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {formStep === 1 && (
                        <Button
                          type="button"
                          onClick={nextStep}
                          disabled={
                            !selectedEventId || parsedSessions.length === 0
                          }
                          className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg"
                        >
                          Continue to Review
                        </Button>
                      )}

                      {formStep === 2 && (
                        <Button
                          type="button"
                          onClick={handleCreateSessions}
                          disabled={loading}
                          className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg"
                        >
                          {loading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Creating {parsedSessions.length} Sessions...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Create {parsedSessions.length} Sessions
                            </>
                          )}
                        </Button>
                      )}

                      {formStep === 3 && (
                        <Button
                          type="button"
                          onClick={handleSendInvitations}
                          disabled={
                            emailSending || createdSessions.length === 0
                          }
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg px-8"
                        >
                          {emailSending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Sending Invitations...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send All Invitations
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="border-gray-700 shadow-xl bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <Sparkles className="h-5 w-5 text-emerald-400" />
                    Excel Session Features
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-emerald-800">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Excel Upload</p>
                      <p className="text-gray-300 text-xs">
                        Upload structured Excel files with session data
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-blue-800">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Bulk Creation</p>
                      <p className="text-gray-300 text-xs">
                        Create multiple sessions automatically from Excel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-green-800">
                      <Mail className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        Smart Invitations
                      </p>
                      <p className="text-gray-300 text-xs">
                        Automatically send personalized emails to faculty
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded bg-purple-800">
                      <Settings className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Data Validation</p>
                      <p className="text-gray-300 text-xs">
                        Automatic validation and error checking
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-700 shadow-xl bg-gray-900/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Progress Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {parsedSessions.length}
                      </div>
                      <p className="text-gray-400 text-sm">Sessions Parsed</p>
                    </div>

                    {formStep >= 3 && (
                      <div>
                        <div className="text-2xl font-bold text-emerald-400">
                          {createdSessions.length}
                        </div>
                        <p className="text-gray-400 text-sm">
                          Sessions Created
                        </p>
                      </div>
                    )}

                    {formStep >= 2 && parsedSessions.length > 0 && (
                      <div className="pt-4 border-t border-gray-700">
                        <div className="text-sm text-gray-300">
                          <div className="flex justify-between mb-2">
                            <span>Unique Faculty:</span>
                            <span>
                              {new Set(parsedSessions.map((s) => s.email)).size}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(
                                  (formStep / 3) * 100,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {formStep === 1 && (
                <Card className="border-gray-700 shadow-xl bg-gray-900/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-white">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                      Excel Format Guide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-800">
                      <p className="font-medium text-blue-200">
                        Required Columns
                      </p>
                      <p className="text-blue-300 text-xs">
                        Ensure all 6 columns are present in your Excel file
                      </p>
                    </div>

                    <div className="p-3 bg-green-900/30 rounded-lg border border-green-800">
                      <p className="font-medium text-green-200">Date Format</p>
                      <p className="text-green-300 text-xs">
                        Use YYYY-MM-DD format (e.g., 2024-09-20)
                      </p>
                    </div>

                    <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-800">
                      <p className="font-medium text-yellow-200">
                        Email Validation
                      </p>
                      <p className="text-yellow-300 text-xs">
                        Ensure all email addresses are valid
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </OrganizerLayout>
  );
};

export default ExcelSessionCreator;
