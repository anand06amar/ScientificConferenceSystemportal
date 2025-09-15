"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner, SkeletonCard } from "@/components/ui/loading";
import { FacultyLayout } from "@/components/dashboard/layout";
import { useRouter } from "next/navigation";
import FeedbackModal from "@/app/modals/Feedback";
import ContactSupportModal from "@/app/modals/contact-support";
import TravelInfoModal from "@/app/modals/TravelInfoModal";
import AccommodationInfoModal from "@/app/modals/AccommodationInfoModal";

import {
  Calendar,
  Clock,
  Upload,
  FileText,
  MapPin,
  Activity,
  ExternalLink,
  ArrowRight,
  Mail,
  MessageSquare,
  Award,
  Hotel,
  Plane,
  Bed,
  Bell,
  Target,
  Zap,
  Shield,
  Presentation,
  Phone,
  Send,
  UserCheck,
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  Star,
  CalendarDays,
  Users,
  CheckCircle2,
  XCircle,
  Clock4,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";

import { useMyFacultyProfile } from "@/hooks/use-faculty";
import {
  useUserSessions,
  useTodaysSessions,
  useUpcomingSessions,
} from "@/hooks/use-sessions";
import { useMyAttendance } from "@/hooks/use-attendance";
import { useMyRegistrations } from "@/hooks/use-registrations";
import { useAuth, useNotifications } from "@/hooks/use-auth";
import { useFacultyEvents } from "@/hooks/use-faculty-events";

const themeClasses = {
  // Main container - light gray background
  container: "min-h-screen bg-gray-100",

  // Text colors - dark text on light backgrounds
  text: {
    primary: "text-gray-900", // Very dark for headings
    secondary: "text-gray-700", // Medium dark for body text
    muted: "text-gray-500", // Light gray for muted text
    accent: "text-blue-600", // Blue for links/accents
    success: "text-green-700", // Dark green for success
    warning: "text-yellow-700", // Dark yellow for warnings
    error: "text-red-700", // Dark red for errors
  },

  // Background colors - light backgrounds
  background: {
    primary: "bg-white", // White for main content
    secondary: "bg-gray-50", // Very light gray for secondary areas
    tertiary: "bg-gray-100", // Light gray for disabled/inactive
    card: "bg-white border-gray-200 shadow-sm", // White cards with light borders
    modal: "bg-white border-gray-200", // White modals
    hover: "hover:bg-gray-50", // Light hover state
  },

  // Border colors
  border: "border-gray-200",

  // Button styles
  button: {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
    secondary:
      "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm",
    success: "bg-green-600 hover:bg-green-700 text-white shadow-sm",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm",
  },

  // Input styles
  input:
    "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500",

  // Alert styles
  alert: {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-green-50 border-green-200 text-green-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
    error: "bg-red-50 border-red-200 text-red-900",
  },

  // Badge styles
  badge: {
    primary: "bg-blue-100 text-blue-900 border-blue-200",
    success: "bg-green-100 text-green-900 border-green-200",
    warning: "bg-yellow-100 text-yellow-900 border-yellow-200",
    danger: "bg-red-100 text-red-900 border-red-200",
    outline: "bg-white text-gray-700 border-gray-300",
    secondary: "bg-gray-100 text-gray-800 border-gray-200",
  },

  // Stats card styles
  stats: {
    sessions: "bg-indigo-50 border-indigo-200 text-indigo-900",
    events: "bg-purple-50 border-purple-200 text-purple-900",
    accepted: "bg-emerald-50 border-emerald-200 text-emerald-900",
    pending: "bg-amber-50 border-amber-200 text-amber-900",
  },

  // Session card styles by status
  sessionCard: {
    pending: "bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-900",
    accepted:
      "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-900",
    declined: "bg-red-50 border-red-200 hover:bg-red-100 text-red-900",
    default: "bg-white border-gray-200 hover:bg-gray-50 text-gray-900",
  },
};

export default function FacultyDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Rest of your state variables (unchanged)
  const [presentationFiles, setPresentationFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const presentationInputRef = useRef<HTMLInputElement>(null);

  const [cvFile, setCVFile] = useState<File | null>(null);
  const [cvIsUploading, setCvIsUploading] = useState(false);
  const [cvProgress, setCvProgress] = useState(0);
  const [cvUploadSuccess, setCvUploadSuccess] = useState<string | null>(null);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isContactSupportOpen, setIsContactSupportOpen] = useState(false);
  const [isTravelModalOpen, setIsTravelModalOpen] = useState(false);
  const [isAccommodationModalOpen, setIsAccommodationModalOpen] =
    useState(false);

  const [facultySessions, setFacultySessions] = useState<any[]>([]);
  const [loadingFacultySessions, setLoadingFacultySessions] = useState(true);
  const [sessionsStats, setSessionsStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    upcoming: 0,
  });

  // Your existing handlers and data fetching logic (unchanged)
  const handleTravelModalOpen = () => setIsTravelModalOpen(true);
  const handleAccommodationModalOpen = () => setIsAccommodationModalOpen(true);

  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useMyFacultyProfile();

  const { data: mySessions, isLoading: userSessionsLoading } = useUserSessions(
    user?.id
  );
  const { data: todaysSessions } = useTodaysSessions();
  const { data: upcomingSessions } = useUpcomingSessions();
  const { data: myAttendance } = useMyAttendance();
  const { data: myRegistrations } = useMyRegistrations();
  const { data: notifications } = useNotifications();

  const {
    events: facultyEvents = [],
    loading: loadingFacultyEvents = false,
    refetch: refetchFacultyEvents,
    respondToEvent,
  } = useFacultyEvents(user?.email) || {};

  // Your existing session management logic (unchanged)
  const fetchFacultySessions = async () => {
    if (!user?.email) {
      setLoadingFacultySessions(false);
      return;
    }

    setLoadingFacultySessions(true);
    try {
      const response = await fetch(
        `/api/faculty/sessions?email=${encodeURIComponent(user.email)}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const sessions = data?.data?.sessions || [];
        setFacultySessions(sessions);

        const stats = {
          total: sessions.length,
          pending: sessions.filter((s: any) => s.inviteStatus === "Pending")
            .length,
          accepted: sessions.filter((s: any) => s.inviteStatus === "Accepted")
            .length,
          declined: sessions.filter((s: any) => s.inviteStatus === "Declined")
            .length,
          upcoming: sessions.filter((s: any) => {
            if (!s.startTime) return false;
            const sessionDate = new Date(s.startTime);
            return sessionDate > new Date();
          }).length,
        };
        setSessionsStats(stats);
      } else {
        console.error("Failed to fetch sessions:", response.status);
        setFacultySessions([]);
        setSessionsStats({
          total: 0,
          pending: 0,
          accepted: 0,
          declined: 0,
          upcoming: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching faculty sessions:", error);
      setFacultySessions([]);
      setSessionsStats({
        total: 0,
        pending: 0,
        accepted: 0,
        declined: 0,
        upcoming: 0,
      });
    } finally {
      setLoadingFacultySessions(false);
    }
  };

  // Your existing useEffect hooks (unchanged)
  useEffect(() => {
    if (user?.email) {
      fetchFacultySessions();
      const interval = setInterval(fetchFacultySessions, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [user?.email]);

  // Your existing navigation and file handlers (keeping the same logic, just commenting for brevity)
  const handleViewProfile = () => router.push("/faculty/profile");
  const handlePresentations = () => router.push("/faculty/presentations");
  const handleSchedule = () => {
    window.open(
      "https://pedicriticon2025.com/scientific-session/",
      "_blank",
      "noopener,noreferrer"
    );
  };
  const handleCertificates = () => router.push("/faculty/certificates");
  const handleSessionClick = () => router.push(`/faculty/sessions`);

  // Your existing stats calculations (unchanged)
  const mySessionsCount = mySessions?.data?.sessions?.length || 0;
  const todaysSessionsCount =
    todaysSessions?.data?.sessions?.filter((s: any) =>
      s.speakers?.some((speaker: any) => speaker.userId === user?.id)
    ).length || 0;
  const upcomingSessionsCount =
    upcomingSessions?.data?.sessions?.filter((s: any) =>
      s.speakers?.some((speaker: any) => speaker.userId === user?.id)
    ).length || 0;
  const registeredEvents = myRegistrations?.data?.registrations?.length || 0;
  const attendanceRate = myAttendance?.data?.attendanceRate || 0;

  const totalPresentations = profile?.data?.presentations?.length || 0;
  const hasCV = !!(profile?.data as any)?.cv;
  const totalDocuments = totalPresentations + (hasCV ? 1 : 0);

  const unreadNotifications =
    notifications?.data?.notifications?.filter((n: any) => !n.readAt).length ||
    0;

  // Your existing profile data calculations (unchanged)
  const profileData = profile?.data as any;
  const profileInstitution = profileData?.institution || "";
  const profileBio = profileData?.bio || "";
  const profileExpertise = profileData?.expertise || "";
  const profileCV = profileData?.cv || null;
  const profilePhoto = profileData?.photo || null;
  const profileUserName = profileData?.user?.name || user?.name || "Faculty";
  const profileUserEmail =
    profileData?.user?.email || user?.email || "faculty@example.com";

  const profileFields = [
    profileBio,
    profileInstitution,
    profileExpertise,
    profileCV,
    profilePhoto,
  ];
  const completedFields = profileFields.filter((field) => field).length;
  const profileCompletionRate = Math.round(
    (completedFields / profileFields.length) * 100
  );

  const userName = profileUserName;
  const userEmail = profileUserEmail;

  // Your existing response handlers (unchanged)
  const [respondSubmitting, setRespondSubmitting] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineTargetType, setDeclineTargetType] = useState<
    "session" | "event"
  >("session");
  const [declineReason, setDeclineReason] = useState<
    "NotInterested" | "SuggestedTopic" | "TimeConflict"
  >("NotInterested");
  const [suggestedTopic, setSuggestedTopic] = useState("");
  const [suggestedStart, setSuggestedStart] = useState("");
  const [suggestedEnd, setSuggestedEnd] = useState("");
  const [optionalQuery, setOptionalQuery] = useState("");

  const openDecline = (id: string, type: "session" | "event" = "session") => {
    setDeclineTargetId(id);
    setDeclineTargetType(type);
    setDeclineReason("NotInterested");
    setSuggestedTopic("");
    setSuggestedStart("");
    setSuggestedEnd("");
    setOptionalQuery("");
    setDeclineOpen(true);
  };

  // Your existing accept/decline handlers (unchanged)
  const acceptSessionInvite = async (id: string) => {
    try {
      setRespondSubmitting(true);
      console.log("🔄 Accepting session:", id);

      const res = await fetch(`/api/sessions/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id,
          inviteStatus: "Accepted",
        }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to accept invitation";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await res.json();
      console.log("✅ Session accepted successfully:", result);

      setFacultySessions((prev: any[]) =>
        prev.map((s) => (s.id === id ? { ...s, inviteStatus: "Accepted" } : s))
      );

      fetchFacultySessions();
      alert("✅ Session accepted successfully!");
    } catch (error: any) {
      console.error("❌ Error accepting session:", error);
      alert(`❌ Error accepting invitation: ${error.message}`);
    } finally {
      setRespondSubmitting(false);
    }
  };

  const acceptEventInvite = async (id: string) => {
    try {
      setRespondSubmitting(true);
      if (respondToEvent) {
        await respondToEvent(id, "ACCEPTED");
        alert("✅ Event accepted successfully!");
      } else {
        throw new Error("Event response function not available");
      }
    } catch (error: any) {
      console.error("❌ Error accepting event:", error);
      alert(`❌ Error accepting event: ${error.message}`);
    } finally {
      setRespondSubmitting(false);
    }
  };

  // Your existing submitDecline handler (unchanged)
  const submitDecline = async () => {
    if (!declineTargetId) return;

    try {
      setRespondSubmitting(true);

      if (declineTargetType === "session") {
        const payload: any = {
          id: declineTargetId,
          inviteStatus: "Declined",
          rejectionReason: declineReason,
        };

        if (declineReason === "SuggestedTopic" && suggestedTopic.trim())
          payload.suggestedTopic = suggestedTopic.trim();

        if (declineReason === "TimeConflict") {
          if (suggestedStart)
            payload.suggestedTimeStart = new Date(suggestedStart).toISOString();
          if (suggestedEnd)
            payload.suggestedTimeEnd = new Date(suggestedEnd).toISOString();
        }

        if (optionalQuery.trim()) payload.optionalQuery = optionalQuery.trim();

        const res = await fetch(`/api/sessions/respond`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let errorMessage = "Failed to decline invitation";
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            errorMessage = `HTTP ${res.status}: ${res.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await res.json();

        setFacultySessions((prev: any[]) =>
          prev.map((s) =>
            s.id === declineTargetId
              ? {
                  ...s,
                  inviteStatus: "Declined",
                  rejectionReason: payload.rejectionReason,
                  suggestedTopic: payload.suggestedTopic,
                  suggestedTimeStart: payload.suggestedTimeStart,
                  suggestedTimeEnd: payload.suggestedTimeEnd,
                  optionalQuery: payload.optionalQuery,
                }
              : s
          )
        );
        fetchFacultySessions();
        alert("✅ Session declined successfully!");
      } else {
        const additionalData: any = { rejectionReason: declineReason };

        if (declineReason === "SuggestedTopic" && suggestedTopic.trim()) {
          additionalData.suggestedTopic = suggestedTopic.trim();
        }

        if (declineReason === "TimeConflict") {
          if (suggestedStart)
            additionalData.suggestedTimeStart = new Date(
              suggestedStart
            ).toISOString();
          if (suggestedEnd)
            additionalData.suggestedTimeEnd = new Date(
              suggestedEnd
            ).toISOString();
        }

        if (optionalQuery.trim())
          additionalData.optionalQuery = optionalQuery.trim();

        if (respondToEvent) {
          await respondToEvent(declineTargetId, "DECLINED", additionalData);
          alert("✅ Event declined successfully!");
        } else {
          throw new Error("Event response function not available");
        }
      }

      setDeclineOpen(false);
    } catch (error: any) {
      console.error("❌ Error declining:", error);
      alert(`❌ Error declining: ${error.message}`);
    } finally {
      setRespondSubmitting(false);
    }
  };

  // FIXED: Helper function to get session card classes based on status
  const getSessionCardClass = (status: string) => {
    const baseClass = `p-4 border rounded-lg cursor-pointer transition-colors`;

    switch (status) {
      case "Pending":
      case "PENDING":
        return `${baseClass} ${themeClasses.sessionCard.pending}`;
      case "Accepted":
      case "ACCEPTED":
        return `${baseClass} ${themeClasses.sessionCard.accepted}`;
      case "Declined":
      case "DECLINED":
        return `${baseClass} ${themeClasses.sessionCard.declined}`;
      default:
        return `${baseClass} ${themeClasses.sessionCard.default}`;
    }
  };

  // Helper function to get badge variant based on status
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case "Accepted":
      case "ACCEPTED":
        return "default";
      case "Pending":
      case "PENDING":
        return "secondary";
      case "Declined":
      case "DECLINED":
        return "destructive";
      default:
        return "outline";
    }
  };

  // FIXED: Sessions and Events Card with proper light theme styling
  const SessionsAndEventsCard = () => (
    <Card className={`lg:col-span-2 ${themeClasses.background.card}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle
            className={`flex items-center gap-2 ${themeClasses.text.primary}`}
          >
            <Presentation className="h-5 w-5" />
            My Sessions & Event Invitations
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchFacultySessions();
                refetchFacultyEvents?.();
              }}
              disabled={loadingFacultySessions || loadingFacultyEvents}
              className={themeClasses.button.secondary}
            >
              <RefreshCw
                className={`h-3 w-3 mr-1 ${
                  loadingFacultySessions || loadingFacultyEvents
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSchedule}
              className={themeClasses.button.secondary}
            >
              <Calendar className="h-3 w-3 mr-1" />
              Full Schedule
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* FIXED: Combined Stats with light theme colors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div
            className={`text-center p-3 rounded-lg border ${themeClasses.stats.sessions}`}
          >
            <div className="text-xl font-bold">{sessionsStats?.total ?? 0}</div>
            <div className="text-xs font-medium">Total Sessions</div>
          </div>
          <div
            className={`text-center p-3 rounded-lg border ${themeClasses.stats.events}`}
          >
            <div className="text-xl font-bold">
              {/* {facultyEvents?.length ?? 0} */} 1
            </div>
            <div className="text-xs font-medium">Event Invitations</div>
          </div>
          <div
            className={`text-center p-3 rounded-lg border ${themeClasses.stats.accepted}`}
          >
            <div className="text-xl font-bold">
              {(sessionsStats?.accepted ?? 0) +
                (facultyEvents?.filter((e: any) => e.status === "ACCEPTED")
                  ?.length ?? 0)}
            </div>
            <div className="text-xs font-medium">Total Accepted</div>
          </div>
          <div
            className={`text-center p-3 rounded-lg border ${themeClasses.stats.pending}`}
          >
            <div className="text-xl font-bold">
              {(sessionsStats?.pending ?? 0) +
                (facultyEvents?.filter((e: any) => e.status === "PENDING")
                  ?.length ?? 0)}
            </div>
            <div className="text-xs font-medium">Total Pending</div>
          </div>
        </div>

        {loadingFacultySessions || loadingFacultyEvents ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div
                  className={`h-4 ${themeClasses.background.tertiary} rounded w-3/4 mb-2`}
                ></div>
                <div
                  className={`h-3 ${themeClasses.background.tertiary} rounded w-1/2`}
                ></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* FIXED: Sessions Section with buttons below location */}
            {facultySessions?.length > 0 && (
              <div className="space-y-4">
                <div
                  className={`flex items-center gap-2 border-b ${themeClasses.border} pb-2`}
                >
                  <Presentation className="h-4 w-4 text-indigo-500" />
                  <h3 className={`font-semibold ${themeClasses.text.primary}`}>
                    Conference Sessions
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-xs ${themeClasses.badge.outline}`}
                  >
                    {facultySessions.length}
                  </Badge>
                </div>
                {facultySessions.slice(0, 3).map((session: any) => (
                  <div
                    key={session.id}
                    className={getSessionCardClass(session.inviteStatus)}
                  >
                    {/* Title and Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <h4
                        className={`font-semibold truncate flex-1 ${themeClasses.text.primary}`}
                      >
                        {session.title || "Untitled Session"}
                      </h4>
                      <Badge
                        variant={getBadgeVariant(session.inviteStatus)}
                        className="text-xs"
                      >
                        {session.inviteStatus || "Unknown"}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="flex items-center mb-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      {(() => {
                        if (!session.formattedTime) return "Date not available";

                        try {
                          const date = new Date(session.formattedTime);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            });
                          }
                        } catch (e) {
                          // If parsing fails, try to extract date patterns
                        }

                        const datePattern1 = session.formattedTime.match(
                          /(\d{1,2}\/\d{1,2}\/\d{4})/
                        );
                        if (datePattern1) {
                          return datePattern1[1];
                        }

                        const datePattern2 =
                          session.formattedTime.match(/(\w+ \d{1,2}, \d{4})/);
                        if (datePattern2) {
                          const date = new Date(datePattern2[1]);
                          return date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          });
                        }

                        const datePattern3 = session.formattedTime.match(
                          /(\d{4}-\d{1,2}-\d{1,2})/
                        );
                        if (datePattern3) {
                          const date = new Date(datePattern3[1]);
                          return date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          });
                        }

                        const firstPart =
                          session.formattedTime.split(/[\s,]+/)[0];
                        return firstPart || session.formattedTime;
                      })()}
                    </div>

                    {/* Location */}
                    <div className="flex items-center mb-3">
                      <MapPin className="h-3 w-3 mr-1" />
                      {(() => {
                        const place =
                          session.place &&
                          !session.place.toLowerCase().includes("tbd")
                            ? session.place
                            : "";
                        const room =
                          session.roomName &&
                          !session.roomName.toLowerCase().includes("tbd")
                            ? session.roomName
                            : "";

                        if (place) return place;
                        return "Location pending";
                      })()}
                    </div>

                    {/* FIXED: Buttons - Both Accept AND Decline below location */}
                    {session.inviteStatus === "Pending" && (
                      <div className="flex gap-2 mb-3">
                        <Button
                          size="sm"
                          disabled={respondSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptSessionInvite(session.id);
                          }}
                          className={`${themeClasses.button.success} flex-1`}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respondSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDecline(session.id, "session");
                          }}
                          className={`${themeClasses.button.secondary} flex-1`}
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    {/* Response Required Message */}
                    {session.inviteStatus === "Pending" && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span
                          className={`text-sm font-medium ${themeClasses.text.warning}`}
                        >
                          Response required
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* FIXED: Events Section with buttons below location */}
            {facultyEvents?.length > 0 && (
              <div className="space-y-4">
                <div
                  className={`flex items-center gap-2 border-b ${themeClasses.border} pb-2`}
                >
                  <CalendarDays className="h-4 w-4 text-purple-500" />
                  <h3 className={`font-semibold ${themeClasses.text.primary}`}>
                    Event Invitations
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-xs ${themeClasses.badge.outline}`}
                  >
                    {facultyEvents.length}
                  </Badge>
                </div>
                {facultyEvents.slice(0, 3).map((event: any) => (
                  <div
                    key={event.id}
                    className={getSessionCardClass(event.status)}
                  >
                    {/* Title and Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <h4
                        className={`font-semibold truncate flex-1 ${themeClasses.text.primary}`}
                      >
                        {event.title || "Untitled Event"}
                      </h4>
                      <Badge
                        variant={getBadgeVariant(event.status)}
                        className="text-xs"
                      >
                        {event.status || "Unknown"}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="flex items-center mb-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      {(() => {
                        if (!event.formattedTime) return "Date not available";

                        try {
                          const date = new Date(event.formattedTime);
                          if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            });
                          }
                        } catch (e) {
                          // If parsing fails, try to extract date patterns
                        }

                        const datePattern1 = event.formattedTime.match(
                          /(\d{1,2}\/\d{1,2}\/\d{4})/
                        );
                        if (datePattern1) {
                          return datePattern1[1];
                        }

                        const datePattern2 =
                          event.formattedTime.match(/(\w+ \d{1,2}, \d{4})/);
                        if (datePattern2) {
                          const date = new Date(datePattern2[1]);
                          return date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          });
                        }

                        const datePattern3 = event.formattedTime.match(
                          /(\d{4}-\d{1,2}-\d{1,2})/
                        );
                        if (datePattern3) {
                          const date = new Date(datePattern3[1]);
                          return date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          });
                        }

                        const firstPart =
                          event.formattedTime.split(/[\s,]+/)[0];
                        return firstPart || event.formattedTime;
                      })()}
                    </div>

                    {/* Location */}
                    <div className="flex items-center mb-3">
                      <MapPin className="h-3 w-3 mr-1" />
                      {(() => {
                        const place =
                          event.place &&
                          !event.place.toLowerCase().includes("tbd")
                            ? event.place
                            : "";
                        const room =
                          event.roomName &&
                          !event.roomName.toLowerCase().includes("tbd")
                            ? event.roomName
                            : "";

                        if (place) return place;
                        return "Location pending";
                      })()}
                    </div>

                    {/* Buttons - NOW BELOW LOCATION */}
                    {event.status === "PENDING" && (
                      <div className="flex gap-2 mb-3">
                        <Button
                          size="sm"
                          disabled={respondSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptEventInvite(event.id);
                          }}
                          className={`${themeClasses.button.success} flex-1`}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={respondSubmitting}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDecline(event.id, "event");
                          }}
                          className={`${themeClasses.button.secondary} flex-1`}
                        >
                          Decline
                        </Button>
                      </div>
                    )}

                    {/* Response Required Message */}
                    {event.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span
                          className={`text-sm font-medium ${themeClasses.text.warning}`}
                        >
                          Response required
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* FIXED: View All Links with light theme */}
            {(facultySessions?.length > 3 || facultyEvents?.length > 3) && (
              <div
                className={`flex gap-4 pt-4 border-t ${themeClasses.border}`}
              >
                {facultySessions?.length > 3 && (
                  <Button
                    variant="outline"
                    onClick={() => router.push("/faculty/sessions")}
                    className={`flex-1 ${themeClasses.button.secondary}`}
                  >
                    View All Sessions ({facultySessions.length})
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {facultyEvents?.length > 3 && (
                  <Button
                    variant="outline"
                    onClick={() => router.push("/faculty/events")}
                    className={`flex-1 ${themeClasses.button.secondary}`}
                  >
                    View All Events ({facultyEvents.length})
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {/* FIXED: Empty State with light theme */}
            {(!facultySessions || facultySessions.length === 0) &&
              (!facultyEvents || facultyEvents.length === 0) && (
                <div className={`text-center py-8 ${themeClasses.text.muted}`}>
                  <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3
                    className={`font-medium mb-2 ${themeClasses.text.primary}`}
                  >
                    No sessions or events yet
                  </h3>
                  <p className="text-sm mb-4">
                    Session and event invitations will appear here when
                    organizers assign you
                  </p>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Loading state
  if (profileLoading || userSessionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <FacultyLayout>
          <div className="p-6 space-y-8">
            <SkeletonCard />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </FacultyLayout>
      </div>
    );
  }

  return (
    <div className={themeClasses.container}>
      <FacultyLayout
        userName={userName}
        userEmail={userEmail}
        headerStats={[
          {
            label: "Sessions",
            value: sessionsStats?.total ?? 0,
            color: "bg-blue-500",
          },
          {
            label: "Events",
            value: 1,
            color: "bg-purple-500",
          },
        ]}
      >
        <div className="space-y-6">
          {/* FIXED: Welcome Header with light theme */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
                Welcome to Pedicriticon 2025
              </h1>
              <p className="text-lg text-slate-700 dark:text-slate-300">
                Faculty Dashboard, {userName}
              </p>
            </div>
          </div>

          {/* FIXED: Notifications Alert with light theme */}
          {unreadNotifications > 0 && (
            <Alert className={themeClasses.alert.info}>
              <Bell className="h-4 w-4" />
              <AlertDescription>
                You have {unreadNotifications} new notifications from
                organizers.
                <Button
                  variant="link"
                  className={`p-0 ml-1 h-auto ${themeClasses.text.accent}`}
                  onClick={() => router.push("/faculty/notifications")}
                >
                  View all
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* FIXED: Stats Grid with light theme */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Sessions Card */}
            <Card
              className={`cursor-pointer hover:shadow-md transition-shadow ${themeClasses.background.card}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle
                  className={`text-sm font-medium ${themeClasses.text.primary}`}
                >
                  My Sessions
                </CardTitle>
                <Presentation
                  className={`h-4 w-4 ${themeClasses.text.muted}`}
                />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${themeClasses.text.primary}`}
                >
                  {sessionsStats?.total ?? 0}
                </div>
                <div
                  className={`flex items-center text-xs ${themeClasses.text.muted} mt-1`}
                >
                  <div className="flex items-center space-x-4">
                    <span className={themeClasses.text.success}>
                      Accepted: {sessionsStats?.accepted ?? 0}
                    </span>
                    <span className={themeClasses.text.warning}>
                      Pending: {sessionsStats?.pending ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accommodation & Travel Card */}
            <Card className={`${themeClasses.background.card}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle
                  className={`text-sm font-medium ${themeClasses.text.primary}`}
                >
                  Accommodation & Travel Status
                </CardTitle>
                <Hotel className={`h-4 w-4 ${themeClasses.text.muted}`} />
              </CardHeader>
              <CardContent>
                <div
                  className={`flex items-center text-xs ${themeClasses.text.muted} mt-1`}
                >
                  <Bed className="h-3 w-3 mr-1 text-purple-600" />
                  Accommodation:{" "}
                  <span
                    className={`ml-1 font-medium ${themeClasses.text.success}`}
                  >
                    Provided on twin-sharing basis
                  </span>
                </div>
                <div
                  className={`flex items-center text-xs ${themeClasses.text.muted} mt-1`}
                >
                  <Plane className="h-3 w-3 mr-1 text-blue-600" />
                  Travel Details:{" "}
                  <span
                    className={`ml-1 font-medium ${themeClasses.text.warning}`}
                  >
                    Self Arranged
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SessionsAndEventsCard />
          </div>
        </div>

        {/* Your existing modals */}
        <FeedbackModal
          open={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
        <ContactSupportModal
          open={isContactSupportOpen}
          onClose={() => setIsContactSupportOpen(false)}
        />
        <TravelInfoModal
          open={isTravelModalOpen}
          onClose={() => setIsTravelModalOpen(false)}
          mode="self-arranged"
        />
        <AccommodationInfoModal
          open={isAccommodationModalOpen}
          onClose={() => setIsAccommodationModalOpen(false)}
        />

        {/* FIXED: Decline Modal with proper light theme */}
        {declineOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div
              className={`w-full max-w-lg mx-4 rounded-xl border shadow-2xl ${themeClasses.background.modal}`}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between p-6 border-b ${themeClasses.border}`}
              >
                <h3
                  className={`text-xl font-bold ${themeClasses.text.primary}`}
                >
                  Decline{" "}
                  {declineTargetType === "session" ? "Session" : "Event"}{" "}
                  Invitation
                </h3>
                <button
                  onClick={() => setDeclineOpen(false)}
                  disabled={respondSubmitting}
                  className={`p-2 rounded-lg ${themeClasses.background.hover} transition-colors ${themeClasses.text.muted}`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                {/* Reason Selection */}
                <div>
                  <label
                    className={`block text-sm font-semibold mb-3 ${themeClasses.text.secondary}`}
                  >
                    Choose a reason for declining
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setDeclineReason("NotInterested")}
                      disabled={respondSubmitting}
                      className={`px-4 py-2 rounded-lg border font-medium transition-all duration-200 ${
                        declineReason === "NotInterested"
                          ? "bg-red-600 border-red-600 text-white"
                          : `${themeClasses.button.secondary} ${themeClasses.background.hover}`
                      }`}
                    >
                      Not Interested
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclineReason("SuggestedTopic")}
                      disabled={respondSubmitting}
                      className={`px-4 py-2 rounded-lg border font-medium transition-all duration-200 ${
                        declineReason === "SuggestedTopic"
                          ? "bg-orange-600 border-orange-600 text-white"
                          : `${themeClasses.button.secondary} ${themeClasses.background.hover}`
                      }`}
                    >
                      Suggest a Topic
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclineReason("TimeConflict")}
                      disabled={respondSubmitting}
                      className={`px-4 py-2 rounded-lg border font-medium transition-all duration-200 ${
                        declineReason === "TimeConflict"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : `${themeClasses.button.secondary} ${themeClasses.background.hover}`
                      }`}
                    >
                      Time Conflict
                    </button>
                  </div>
                </div>

                {/* Suggested Topic Input */}
                {declineReason === "SuggestedTopic" && (
                  <div className="space-y-2">
                    <label
                      className={`block text-sm font-medium ${themeClasses.text.secondary}`}
                    >
                      Suggested Topic
                    </label>
                    <input
                      type="text"
                      className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all ${themeClasses.input}`}
                      placeholder="e.g., Emerging Trends in GenAI"
                      value={suggestedTopic}
                      onChange={(e) => setSuggestedTopic(e.target.value)}
                      disabled={respondSubmitting}
                    />
                  </div>
                )}

                {/* Time Conflict Inputs */}
                {declineReason === "TimeConflict" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        className={`block text-sm font-medium ${themeClasses.text.secondary}`}
                      >
                        Suggested Start Time
                      </label>
                      <input
                        type="datetime-local"
                        className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all ${themeClasses.input}`}
                        value={suggestedStart}
                        onChange={(e) => setSuggestedStart(e.target.value)}
                        disabled={respondSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className={`block text-sm font-medium ${themeClasses.text.secondary}`}
                      >
                        Suggested End Time
                      </label>
                      <input
                        type="datetime-local"
                        className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all ${themeClasses.input}`}
                        value={suggestedEnd}
                        onChange={(e) => setSuggestedEnd(e.target.value)}
                        disabled={respondSubmitting}
                      />
                    </div>
                  </div>
                )}

                {/* Optional Message */}
                <div className="space-y-2">
                  <label
                    className={`block text-sm font-medium ${themeClasses.text.secondary}`}
                  >
                    Optional Message
                  </label>
                  <textarea
                    rows={4}
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all resize-none ${themeClasses.input}`}
                    placeholder="Add an optional message for the organizer..."
                    value={optionalQuery}
                    onChange={(e) => setOptionalQuery(e.target.value)}
                    disabled={respondSubmitting}
                  />
                </div>
              </div>

              {/* Actions */}
              <div
                className={`flex justify-end gap-3 p-6 pt-4 border-t ${themeClasses.border}`}
              >
                <Button
                  onClick={() => setDeclineOpen(false)}
                  disabled={respondSubmitting}
                  variant="outline"
                  className={themeClasses.button.secondary}
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitDecline}
                  disabled={respondSubmitting}
                  className={themeClasses.button.danger}
                >
                  {respondSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Decline"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </FacultyLayout>
    </div>
  );
}
