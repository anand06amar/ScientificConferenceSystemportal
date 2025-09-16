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
  FileSpreadsheet,
  Download,
  Sparkles,
  RefreshCw,
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
  role: string;
  roomId: string;
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

  // Parse Excel file with comprehensive error handling
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Safe access to sheet name with proper validation
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("No worksheets found in Excel file");
        }

        const sheetName = workbook.SheetNames[0];

        // Check if sheetName exists before using as index
        if (!sheetName) {
          throw new Error("Invalid worksheet name");
        }

        // Safe worksheet access
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          throw new Error("Worksheet not found");
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log("Parsed Excel data:", jsonData);

        // Safe mapping with proper type checking
        const sessions: ExcelSessionData[] = jsonData.map(
          (row: any, index: number) => {
            // Safe property access with fallbacks
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
              roomId: "", // Initialize as empty string
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

    // Clear validation error for this field
    const errorKey = `${sessionId}-${field === "roomId" ? "room" : field}`;
    if (validationErrors[errorKey]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  // Comprehensive form validation
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!selectedEventId) {
      errors.selectedEventId = "Please select an event";
    }

    if (parsedSessions.length === 0) {
      errors.excelFile = "Please upload and parse an Excel file";
    }

    // Validate each session
    parsedSessions.forEach((session) => {
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
      // Ensure room is assigned
      if (!session.roomId || session.roomId.trim() === "") {
        errors[`${session.id}-room`] = "Room assignment is required";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create all sessions with comprehensive error handling
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

        // Helper function for safe FormData appending
        const appendSafely = (
          key: string,
          value: string | undefined | null,
          isRequired = true
        ) => {
          if (value !== undefined && value !== null && value.trim() !== "") {
            formData.append(key, value.trim());
          } else if (isRequired) {
            throw new Error(
              `Missing required field: ${key} for session "${session.sessionTitle}"`
            );
          }
        };

        // Safe appending with validation
        try {
          appendSafely("title", session.sessionTitle);
          appendSafely("facultyId", `excel-faculty-${session.email}`);
          appendSafely("email", session.email);
          appendSafely("place", session.place);

          // Ensure roomId is assigned before proceeding
          if (!session.roomId || session.roomId.trim() === "") {
            throw new Error(
              `Session "${session.sessionTitle}" is missing room assignment. Please assign a room to all sessions.`
            );
          }
          appendSafely("roomId", session.roomId);

          appendSafely("description", session.role);
          appendSafely("status", session.status);
          appendSafely("eventId", selectedEventId);
          formData.append("invite_status", "Pending");

          // Safe date handling
          if (session.date) {
            try {
              const sessionDate = new Date(session.date);
              if (isNaN(sessionDate.getTime())) {
                throw new Error("Invalid date");
              }

              const startTime = `${
                sessionDate.toISOString().split("T")[0]
              }T09:00:00`;
              const endTime = `${
                sessionDate.toISOString().split("T")[0]
              }T17:00:00`;

              formData.append("suggested_time_start", startTime);
              formData.append("suggested_time_end", endTime);
            } catch (dateError) {
              console.error("Date parsing error:", dateError);
              throw new Error(
                `Invalid date format for session: ${session.sessionTitle}`
              );
            }
          } else {
            throw new Error(
              `Session "${session.sessionTitle}" is missing date`
            );
          }

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
            console.log(
              `Session created successfully: ${session.sessionTitle}`
            );
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
        } catch (validationError) {
          console.error(
            `Validation error for session "${session.sessionTitle}":`,
            validationError
          );
          throw validationError;
        }
      }

      setCreatedSessions(createdSessionsList);
      setSuccessMessage(
        `🎉 Successfully created ${createdSessionsList.length} sessions and stored them in the database!`
      );
      setFormStep(3); // Move to success step
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

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Faculty Name": "Dr. John Smith",
        Email: "john.smith@university.edu",
        Place: "Main Campus",
        "Session Title": "Introduction to AI",
        Date: "2025-09-20",
        Role: "Keynote Speaker - Artificial Intelligence Expert",
      },
      {
        "Faculty Name": "Prof. Jane Doe",
        Email: "jane.doe@university.edu",
        Place: "Science Building",
        "Session Title": "Data Science Workshop",
        Date: "2025-09-21",
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

  // Helper function to check if all sessions have room assignments
  const allRoomsAssigned = parsedSessions.every(
    (s) => s.roomId && s.roomId.trim() !== ""
  );
  const assignedRoomsCount = parsedSessions.filter(
    (s) => s.roomId && s.roomId.trim() !== ""
  ).length;

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

            {/* ✅ UPDATED: Progress Steps (Removed Email Step) */}
            <div className="flex items-center justify-center gap-4 mb-8">
              {[
                { step: 1, title: "Event & Excel Upload", icon: Upload },
                { step: 2, title: "Review & Create Sessions", icon: Eye },
                { step: 3, title: "Success", icon: CheckCircle },
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
                    {formStep === 3 && "Sessions Created Successfully!"}
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
                          style={{ colorScheme: "dark" }}
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
                        <div className="flex items-center gap-4">
                          <Badge className="bg-emerald-800 text-emerald-200">
                            Event:{" "}
                            {events.find((e) => e.id === selectedEventId)?.name}
                          </Badge>
                          <Badge
                            className={
                              allRoomsAssigned
                                ? "bg-green-800 text-green-200"
                                : "bg-red-800 text-red-200"
                            }
                          >
                            Rooms: {assignedRoomsCount}/{parsedSessions.length}{" "}
                            Assigned
                          </Badge>
                        </div>
                      </div>

                      {/* Show warning if any sessions are missing room assignments */}
                      {!allRoomsAssigned && (
                        <Alert className="border-red-600 bg-red-900/20">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <AlertDescription className="text-red-200">
                            <strong>Action Required:</strong> Please assign
                            rooms to all sessions before proceeding.
                            {parsedSessions.length - assignedRoomsCount}{" "}
                            sessions are missing room assignments.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {parsedSessions.map((session, index) => (
                          <Card
                            key={session.id}
                            className={`border-gray-600 bg-gray-800/50 ${
                              !session.roomId || session.roomId.trim() === ""
                                ? "border-red-500 bg-red-900/10"
                                : ""
                            }`}
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
                                {/* Dark themed room dropdown */}
                                <div className="md:col-span-2">
                                  <label className="text-gray-400 block mb-1">
                                    Room: *
                                  </label>
                                  <select
                                    value={session.roomId}
                                    onChange={(e) =>
                                      updateSession(
                                        session.id,
                                        "roomId",
                                        e.target.value
                                      )
                                    }
                                    className={`w-full p-3 text-sm rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                      !session.roomId ||
                                      session.roomId.trim() === "" ||
                                      validationErrors[`${session.id}-room`]
                                        ? "bg-red-900/20 border-2 border-red-500 text-red-200"
                                        : "bg-gray-800 border-2 border-gray-600 text-white hover:border-gray-500 focus:border-emerald-400"
                                    }`}
                                    style={{ colorScheme: "dark" }}
                                  >
                                    <option
                                      value=""
                                      className="bg-gray-800 text-gray-400"
                                    >
                                      ⚠️ Select Room (Required)
                                    </option>
                                    {rooms.map((room) => (
                                      <option
                                        key={room.id}
                                        value={room.id}
                                        className="bg-gray-800 text-white py-2"
                                      >
                                        {room.name}
                                      </option>
                                    ))}
                                  </select>
                                  {(!session.roomId ||
                                    session.roomId.trim() === "") && (
                                    <p className="text-red-400 text-xs mt-1">
                                      Room assignment is required
                                    </p>
                                  )}
                                  {validationErrors[`${session.id}-room`] && (
                                    <p className="text-red-400 text-xs mt-1">
                                      {validationErrors[`${session.id}-room`]}
                                    </p>
                                  )}
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
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Ready status with room validation */}
                      <div
                        className={`border rounded-lg p-4 ${
                          allRoomsAssigned
                            ? "bg-emerald-900/20 border-emerald-700"
                            : "bg-yellow-900/20 border-yellow-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {allRoomsAssigned ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                              <span className="font-medium text-emerald-200">
                                Ready to create {parsedSessions.length} sessions
                                - All rooms assigned ✓
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-400" />
                              <span className="font-medium text-yellow-200">
                                Please assign rooms to all sessions before
                                proceeding
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ UPDATED: Step 3 - Success Message (No Email Functionality) */}
                  {formStep === 3 && (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-br from-emerald-800 to-emerald-800/50 rounded-xl p-6 border border-emerald-700">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                          Sessions Created Successfully!
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
                              Sessions Created & Stored in Database ✓
                            </p>
                          </div>
                        </div>

                        {/* Faculty List */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-300">
                            Faculty Sessions:
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
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-200">
                          <strong>
                            All sessions have been created and stored
                            successfully!
                          </strong>
                          <br />
                          {createdSessions.length} sessions have been created
                          for{" "}
                          {
                            new Set(
                              createdSessions.map(
                                (s) => s.originalEmail || s.email
                              )
                            ).size
                          }{" "}
                          faculty members and saved to the database.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* ✅ UPDATED: Navigation Buttons */}
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
                          className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg disabled:opacity-50"
                        >
                          Continue to Review
                        </Button>
                      )}

                      {formStep === 2 && (
                        <Button
                          type="button"
                          onClick={handleCreateSessions}
                          disabled={loading || !allRoomsAssigned}
                          className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onClick={resetForm}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg px-8"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Create More Sessions
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ✅ UPDATED: Sidebar (Removed Email References) */}
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
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Database Storage</p>
                      <p className="text-gray-300 text-xs">
                        Sessions automatically saved to database
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
                            <span>Rooms Assigned:</span>
                            <span
                              className={
                                allRoomsAssigned
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {assignedRoomsCount}/{parsedSessions.length}
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                allRoomsAssigned
                                  ? "bg-emerald-600"
                                  : "bg-red-600"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (assignedRoomsCount / parsedSessions.length) *
                                    100,
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
            </div>
          </div>
        </div>
      </div>
    </OrganizerLayout>
  );
};

export default ExcelSessionCreator;
