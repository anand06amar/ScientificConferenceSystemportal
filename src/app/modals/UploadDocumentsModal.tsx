// // app/modals/uploadDocumentsModal.tsx
// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useSession } from "next-auth/react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogDescription,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Upload, FileText, Presentation } from "lucide-react";

// type Session = {
//   id: string;
//   title?: string;
//   inviteStatus?: "Accepted" | "Pending" | "Declined";
//   formattedTime?: string;
//   formattedStartTime?: string;
//   formattedEndTime?: string;
//   place?: string;
//   roomName?: string;
//   eventName?: string;
// };

// type Props = {
//   isOpen: boolean;
//   onClose: () => void;
//   facultyId: string;
// };

// const CV_MAX_MB = 10;
// const PRES_MAX_MB = 50;

// const cvMimes = [
//   "application/pdf",
//   "application/msword",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// ];

// const presMimes = [
//   "application/vnd.ms-powerpoint",
//   "application/vnd.openxmlformats-officedocument.presentationml.presentation",
//   "application/pdf",
//   "application/msword",
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
// ];

// export default function UploadDocumentsModal({ isOpen, onClose, facultyId }: Props) {
//   const { data: session } = useSession();
//   const email = session?.user?.email || "";

//   // Sessions state
//   const [sessions, setSessions] = useState<Session[]>([]);
//   const [sessionsLoading, setSessionsLoading] = useState(false);
//   const [sessionsErr, setSessionsErr] = useState<string | null>(null);
//   const acceptedSessions = useMemo(
//     () => sessions.filter((s) => s.inviteStatus === "Accepted"),
//     [sessions]
//   );
//   const [selectedSessionId, setSelectedSessionId] = useState<string>("");

//   // Files state
//   const [cvFile, setCvFile] = useState<File | null>(null);
//   const [presFiles, setPresFiles] = useState<File[]>([]);

//   // UI state
//   const [busy, setBusy] = useState(false);
//   const [msg, setMsg] = useState<string | null>(null);
//   const [err, setErr] = useState<string | null>(null);

//   // Load sessions when the dialog opens
//   useEffect(() => {
//     if (!isOpen || !email) return;
//     const run = async () => {
//       try {
//         setSessionsLoading(true);
//         setSessionsErr(null);
//         const res = await fetch(
//           `/api/faculty/sessions?email=${encodeURIComponent(email)}`,
//           { cache: "no-store", headers: { "Content-Type": "application/json" } }
//         );
//         if (!res.ok) {
//           const j = await res.json().catch(() => ({}));
//           throw new Error(j.error || `Failed to load sessions (${res.status})`);
//         }
//         const j = await res.json();
//         const list: Session[] = j?.data?.sessions || [];
//         setSessions(Array.isArray(list) ? list : []);
//       } catch (e: any) {
//         setSessionsErr(e?.message || "Failed to load sessions");
//         setSessions([]);
//       } finally {
//         setSessionsLoading(false);
//       }
//     };
//     run();
//   }, [isOpen, email]);

//   // Validation
//   const validate = (file: File, kind: "cv" | "pres") => {
//     if (kind === "cv") {
//       if (!cvMimes.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name))
//         return "CV must be PDF/DOC/DOCX";
//       if (file.size > CV_MAX_MB * 1024 * 1024)
//         return `CV must be <= ${CV_MAX_MB}MB`;
//     } else {
//       if (
//         !presMimes.includes(file.type) &&
//         !/\.(pdf|ppt|pptx|doc|docx)$/i.test(file.name)
//       )
//         return "Presentation must be PDF/PPT/PPTX/DOC/DOCX";
//       if (file.size > PRES_MAX_MB * 1024 * 1024)
//         return `Presentation must be <= ${PRES_MAX_MB}MB`;
//     }
//     return null;
//   };

//   const onPickCv = (f: File | null) => {
//     if (!f) return setCvFile(null);
//     const v = validate(f, "cv");
//     if (v) return setErr(v);
//     setErr(null);
//     setCvFile(f);
//   };

//   // Accumulate multiple selections; de-duplicate by name/size/lastModified
//   const onPickPres = (files: FileList | null) => {
//     if (!files) return;
//     const incoming = Array.from(files);
//     for (const f of incoming) {
//       const v = validate(f, "pres");
//       if (v) return setErr(v);
//     }
//     setErr(null);
//     setPresFiles((prev) => {
//       const key = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
//       const map = new Map<string, File>();
//       [...prev, ...incoming].forEach((f) => map.set(key(f), f));
//       return Array.from(map.values());
//     });
//   };

//   // API calls
//   const uploadCv = async (sessionId: string) => {
//     if (!cvFile) return;
//     const fd = new FormData();
//     fd.append("file", cvFile, cvFile.name);
//     fd.append("facultyId", facultyId);
//     fd.append("sessionId", sessionId); // optional association
//     const res = await fetch("/api/faculty/cv", { method: "POST", body: fd });
//     if (!res.ok) {
//       const j = await res.json().catch(() => ({}));
//       throw new Error(j.error || `CV upload failed (${res.status})`);
//     }
//   };

//   const uploadPresentations = async (sessionId: string) => {
//     if (presFiles.length === 0) return;
//     const fd = new FormData();
//     for (const f of presFiles) {
//       fd.append("files", f, f.name); // repeated key for multi-file uploads
//       fd.append("titles", f.name);   // optional title aligned by index
//     }
//     fd.append("facultyId", facultyId);
//     fd.append("sessionId", sessionId);
//     const res = await fetch("/api/faculty/presentations/upload", {
//       method: "POST",
//       body: fd,
//     });
//     if (!res.ok) {
//       const j = await res.json().catch(() => ({}));
//       throw new Error(j.error || `Presentations upload failed (${res.status})`);
//     }
//   };

//   const onSubmit = async () => {
//     try {
//       setBusy(true);
//       setMsg(null);
//       setErr(null);
//       if (!selectedSessionId) throw new Error("Select a session first");
//       if (!cvFile && presFiles.length === 0)
//         throw new Error("Attach a CV and/or at least one presentation");

//       if (cvFile) await uploadCv(selectedSessionId);
//       if (presFiles.length > 0) await uploadPresentations(selectedSessionId);

//       setMsg("Upload complete.");
//       setCvFile(null);
//       setPresFiles([]);
//       setTimeout(() => onClose(), 600);
//     } catch (e: any) {
//       setErr(e?.message || "Upload failed");
//     } finally {
//       setBusy(false);
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
//       <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-slate-100">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <FileText className="h-5 w-5" />
//             Upload Documents
//           </DialogTitle>
//           <DialogDescription className="text-slate-400">
//             Select an accepted session, then upload a CV and multiple presentations for that session.
//           </DialogDescription>
//         </DialogHeader>

//         {/* Session select */}
//         <div className="space-y-2">
//           <div className="text-sm font-medium">Select Accepted Session</div>
//           {sessionsLoading ? (
//             <div className="text-sm text-slate-300">Loading sessions…</div>
//           ) : sessionsErr ? (
//             <div className="text-sm text-red-400">{sessionsErr}</div>
//           ) : acceptedSessions.length === 0 ? (
//             <div className="rounded border border-slate-800 bg-slate-800/40 p-3 text-xs text-slate-300">
//               No accepted sessions available.
//             </div>
//           ) : (
//             <select
//               className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm"
//               value={selectedSessionId}
//               onChange={(e) => setSelectedSessionId(e.target.value)}
//             >
//               <option value="">Select a session…</option>
//               {acceptedSessions.map((s) => (
//                 <option key={s.id} value={s.id}>
//                   {s.title || "Untitled Session"}
//                 </option>
//               ))}
//             </select>
//           )}
//         </div>

//         {!selectedSessionId ? (
//           <div className="mt-4 rounded border border-slate-800 bg-slate-800/40 p-3 text-xs text-slate-300">
//             Choose a session to enable uploads.
//           </div>
//         ) : (
//           <>
//             {/* CV */}
//             <div className="mt-4 space-y-2">
//               <div className="text-sm font-medium">Curriculum Vitae (CV)</div>
//               <p className="text-xs text-slate-400">
//                 Accepted: PDF, DOC, DOCX. Max {CV_MAX_MB}MB.
//               </p>
//               <div className="flex items-center gap-3">
//                 <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
//                   <Upload className="h-4 w-4" />
//                   <span>{cvFile ? "Replace CV" : "Select CV"}</span>
//                   <input
//                     type="file"
//                     className="hidden"
//                     accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//                     onChange={(e) => onPickCv(e.target.files?.[0] ?? null)}
//                   />
//                 </label>
//                 {cvFile && (
//                   <>
//                     <div className="text-xs text-slate-300 truncate max-w-[60%]">
//                       {cvFile.name} • {(cvFile.size / (1024 * 1024)).toFixed(2)} MB
//                     </div>
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       className="border-red-600 text-red-400 hover:bg-red-900/20"
//                       onClick={() => setCvFile(null)}
//                     >
//                       Remove
//                     </Button>
//                   </>
//                 )}
//               </div>
//             </div>

//             {/* Presentations (Add files, accumulate) */}
//             <div className="mt-6 space-y-2">
//               <div className="flex items-center gap-2">
//                 <Presentation className="h-4 w-4" />
//                 <div className="text-sm font-medium">Presentations (Multiple)</div>
//               </div>
//               <p className="text-xs text-slate-400">
//                 Accepted: PDF, PPT, PPTX, DOC, DOCX. Max {PRES_MAX_MB}MB each.
//               </p>
//               <div className="flex items-center gap-3">
//                 <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">
//                   <Upload className="h-4 w-4" />
//                   <span>Add files</span>
//                   <input
//                     type="file"
//                     multiple
//                     className="hidden"
//                     accept=".pdf,.ppt,.pptx,.doc,.docx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//                     onChange={(e) => onPickPres(e.target.files)}
//                   />
//                 </label>
//                 {presFiles.length > 0 && (
//                   <>
//                     <div className="text-xs text-slate-300 truncate max-w-[60%]">
//                       {presFiles.length} file(s) selected
//                     </div>
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       className="border-red-600 text-red-400 hover:bg-red-900/20"
//                       onClick={() => setPresFiles([])}
//                     >
//                       Clear
//                     </Button>
//                   </>
//                 )}
//               </div>
//               {presFiles.length > 0 && (
//                 <ul className="mt-2 max-h-28 overflow-auto space-y-1 text-xs text-slate-300">
//                   {presFiles.map((f, i) => (
//                     <li key={i} className="truncate">
//                       {f.name} • {(f.size / (1024 * 1024)).toFixed(2)} MB
//                     </li>
//                   ))}
//                 </ul>
//               )}
//             </div>
//           </>
//         )}

//         {/* Footer */}
//         <div className="mt-6 flex items-center justify-between">
//           <div className="text-xs">
//             {err && <span className="text-red-400">{err}</span>}
//             {msg && <span className="text-emerald-400">{msg}</span>}
//           </div>
//           <div className="flex gap-2">
//             <Button variant="outline" onClick={onClose} disabled={busy}>
//               Cancel
//             </Button>
//             <Button
//               onClick={onSubmit}
//               disabled={
//                 busy || !selectedSessionId || (!cvFile && presFiles.length === 0)
//               }
//               className="bg-blue-600 hover:bg-blue-700"
//             >
//               {busy ? "Uploading..." : "Upload"}
//             </Button>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }


// app/modals/UploadDocumentsModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Presentation } from "lucide-react";

type Session = {
  id: string;
  title?: string;
  inviteStatus?: "Accepted" | "Pending" | "Declined";
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  facultyId: string;
};

const CV_MAX_MB = 10;
const PRES_MAX_MB = 50;

const cvMimes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const presMimes = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function UploadDocumentsModal({
  isOpen,
  onClose,
  facultyId,
}: Props) {
  const { data: session } = useSession();
  const email = session?.user?.email || "";

  // State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsErr, setSessionsErr] = useState<string | null>(null);
  const acceptedSessions = useMemo(
    () => sessions.filter((s) => s.inviteStatus === "Accepted"),
    [sessions]
  );
  const [selectedSessionId, setSelectedSessionId] = useState("");

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [presFiles, setPresFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Load sessions
  useEffect(() => {
    if (!isOpen || !email) return;
    (async () => {
      try {
        setSessionsLoading(true);
        setSessionsErr(null);

        const res = await fetch(`/api/faculty/sessions?email=${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error(`Failed (${res.status})`);

        const j = await res.json();
        setSessions(Array.isArray(j?.data?.sessions) ? j.data.sessions : []);
      } catch (e: any) {
        setSessionsErr(e?.message || "Failed to load sessions");
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    })();
  }, [isOpen, email]);

  // File validation
  const validate = (file: File, kind: "cv" | "pres") => {
    if (kind === "cv") {
      if (!cvMimes.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name))
        return "CV must be PDF/DOC/DOCX";
      if (file.size > CV_MAX_MB * 1024 * 1024)
        return `CV must be ≤ ${CV_MAX_MB}MB`;
    } else {
      if (
        !presMimes.includes(file.type) &&
        !/\.(pdf|ppt|pptx|doc|docx)$/i.test(file.name)
      )
        return "Presentation must be PDF/PPT/PPTX/DOC/DOCX";
      if (file.size > PRES_MAX_MB * 1024 * 1024)
        return `Presentation must be ≤ ${PRES_MAX_MB}MB`;
    }
    return null;
  };

  const onPickCv = (f: File | null) => {
    if (!f) return setCvFile(null);
    const v = validate(f, "cv");
    if (v) return setErr(v);
    setErr(null);
    setCvFile(f);
  };

  const onPickPres = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    for (const f of incoming) {
      const v = validate(f, "pres");
      if (v) return setErr(v);
    }
    setErr(null);
    setPresFiles((prev) => [...prev, ...incoming]);
  };

  // Upload handlers
  const uploadCv = async (sessionId: string) => {
    if (!cvFile) return;
    const fd = new FormData();
    fd.append("file", cvFile);
    fd.append("facultyId", facultyId);
    fd.append("sessionId", sessionId);

    const res = await fetch("/api/faculty/cv", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`CV upload failed (${res.status})`);
  };

  const uploadPres = async (sessionId: string) => {
    if (presFiles.length === 0) return;
    const fd = new FormData();
    presFiles.forEach((f) => fd.append("files", f));
    fd.append("facultyId", facultyId);
    fd.append("sessionId", sessionId);

    const res = await fetch("/api/faculty/presentations/upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`Presentation upload failed (${res.status})`);
  };

  const onSubmit = async () => {
    try {
      setBusy(true);
      setMsg(null);
      setErr(null);

      if (!selectedSessionId) throw new Error("Select a session");
      if (!cvFile && presFiles.length === 0)
        throw new Error("Attach a CV or at least one presentation");

      if (cvFile) await uploadCv(selectedSessionId);
      if (presFiles.length > 0) await uploadPres(selectedSessionId);

      setMsg("Upload successful ✅");
      setCvFile(null);
      setPresFiles([]);
      setTimeout(() => onClose(), 1000);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Documents
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select an accepted session, then upload your CV and/or presentations.
          </DialogDescription>
        </DialogHeader>

        {/* Sessions */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Accepted Session</div>
          {sessionsLoading ? (
            <div className="text-sm text-slate-300">Loading…</div>
          ) : sessionsErr ? (
            <div className="text-sm text-red-400">{sessionsErr}</div>
          ) : acceptedSessions.length === 0 ? (
            <div className="rounded border border-slate-800 bg-slate-800/40 p-3 text-xs text-slate-300">
              No accepted sessions
            </div>
          ) : (
            <select
              className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-sm"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              <option value="">Select a session…</option>
              {acceptedSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled"}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Upload sections */}
        {selectedSessionId && (
          <>
            {/* CV */}
            <div className="mt-4">
              <div className="text-sm font-medium">Curriculum Vitae (CV)</div>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => onPickCv(e.target.files?.[0] ?? null)}
                className="mt-2 text-sm"
              />
              {cvFile && (
                <p className="text-xs mt-1 text-slate-300">
                  {cvFile.name} • {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            {/* Presentations */}
            <div className="mt-4">
              <div className="text-sm font-medium">Presentations</div>
              <input
                type="file"
                multiple
                accept=".pdf,.ppt,.pptx,.doc,.docx"
                onChange={(e) => onPickPres(e.target.files)}
                className="mt-2 text-sm"
              />
              {presFiles.length > 0 && (
                <ul className="mt-2 text-xs text-slate-300 space-y-1 max-h-24 overflow-y-auto">
                  {presFiles.map((f, i) => (
                    <li key={i}>
                      {f.name} • {(f.size / 1024 / 1024).toFixed(2)} MB
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs">
            {err && <span className="text-red-400">{err}</span>}
            {msg && <span className="text-emerald-400">{msg}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={
                busy || !selectedSessionId || (!cvFile && presFiles.length === 0)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
