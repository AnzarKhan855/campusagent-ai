"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Subject = {
  id: string;
  _id?: string;
  name: string;
  code?: string;
  teacher?: string;
  color?: string;
};

type Assignment = {
  id: string;
  _id?: string;
  title: string;
  subject_id: string;
  subject?: string;
  subject_name?: string;
  description: string;
  details?: string;
  due_date: string;
  priority: string;
  status: string;
  user_id?: string;
  created_at?: string;
  pdf_filename?: string;
  has_pdf?: boolean;
  questions_count?: number;
  answered_count?: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function AssignmentsPanel() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");

  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("pending");

  const buttonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const deleteButtonClass =
    "rounded-xl border border-red-500/40 bg-[#111827] px-4 py-2 text-sm font-semibold text-red-300 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const addButtonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-5 py-3 font-bold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2";

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  function getAssignmentId(assignment: Assignment) {
    return assignment.id || assignment._id || "";
  }

  async function fetchSubjects() {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/subjects`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch subjects");
      }

      const userSubjects = data.subjects || [];
      setSubjects(userSubjects);

      if (userSubjects.length > 0 && !subjectId) {
        setSubjectId(userSubjects[0].id || userSubjects[0]._id);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while fetching subjects."
      );
    }
  }

  async function fetchAssignments() {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch assignments");
      }

      setAssignments(data.assignments || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while fetching assignments."
      );
    }
  }

  useEffect(() => {
    fetchSubjects();
    fetchAssignments();
  }, []);

  async function handleAddAssignment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    if (!title.trim()) {
      setMessage("Assignment title is required.");
      return;
    }

    if (!subjectId) {
      setMessage("Please select a subject.");
      return;
    }

    if (!dueDate) {
      setMessage("Due date is required.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          subject_id: subjectId,
          description,
          due_date: dueDate,
          priority,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to add assignment");
      }

      setAssignments((prev) => [data.assignment, ...prev]);

      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("pending");

      setMessage("Assignment added successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while adding assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadPdf(assignmentId: string, file?: File) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    if (!file) {
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage("Please upload only a PDF file.");
      return;
    }

    try {
      setUploadingId(assignmentId);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/upload-pdf`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload PDF");
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          getAssignmentId(assignment) === assignmentId
            ? data.assignment
            : assignment
        )
      );

      setMessage("PDF uploaded and parsed successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading PDF."
      );
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeletePdf(assignmentId: string) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    const confirmDelete = window.confirm(
      "Delete this uploaded PDF? Extracted questions and saved answers from this PDF will also be removed."
    );

    if (!confirmDelete) {
      return;
    }

    try {
      setDeletingPdfId(assignmentId);
      setMessage("");

      const res = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/delete-pdf`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete PDF");
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          getAssignmentId(assignment) === assignmentId
            ? data.assignment
            : assignment
        )
      );

      setMessage("PDF deleted successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting PDF."
      );
    } finally {
      setDeletingPdfId(null);
    }
  }

  function startEditAssignment(assignment: Assignment) {
    setEditingId(getAssignmentId(assignment));
    setEditTitle(assignment.title || "");
    setEditSubjectId(assignment.subject_id || "");
    setEditDescription(assignment.details || assignment.description || "");
    setEditDueDate(assignment.due_date || "");
    setEditPriority(assignment.priority || "medium");
    setEditStatus(assignment.status || "pending");
    setMessage("");
  }

  function cancelEditAssignment() {
    setEditingId(null);
    setEditTitle("");
    setEditSubjectId("");
    setEditDescription("");
    setEditDueDate("");
    setEditPriority("medium");
    setEditStatus("pending");
  }

  async function handleUpdateAssignment(assignmentId: string) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    if (!editTitle.trim()) {
      setMessage("Assignment title is required.");
      return;
    }

    if (!editSubjectId) {
      setMessage("Please select a subject.");
      return;
    }

    if (!editDueDate) {
      setMessage("Due date is required.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          subject_id: editSubjectId,
          description: editDescription,
          details: editDescription,
          due_date: editDueDate,
          priority: editPriority,
          status: editStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update assignment");
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          getAssignmentId(assignment) === assignmentId
            ? data.assignment
            : assignment
        )
      );

      cancelEditAssignment();
      setMessage("Assignment updated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating assignment."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAssignment(assignmentId: string) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    const confirmDelete = window.confirm(
      "Delete this assignment permanently?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete assignment");
      }

      setAssignments((prev) =>
        prev.filter(
          (assignment) => getAssignmentId(assignment) !== assignmentId
        )
      );

      setMessage("Assignment deleted successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting assignment."
      );
    }
  }

  function getSubjectName(assignment: Assignment) {
    if (assignment.subject || assignment.subject_name) {
      return assignment.subject || assignment.subject_name || "Unknown Subject";
    }

    const subject = subjects.find(
      (item) =>
        item.id === assignment.subject_id || item._id === assignment.subject_id
    );

    return subject ? subject.name : "Unknown Subject";
  }

  const pendingCount = assignments.filter(
    (assignment) => assignment.status === "pending"
  ).length;

  const completedCount = assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  const highPriorityCount = assignments.filter(
    (assignment) => assignment.priority === "high"
  ).length;

  function getPriorityClass(priorityValue: string) {
    if (priorityValue === "high") {
      return "border-red-400/30 bg-red-500/10 text-red-300";
    }

    if (priorityValue === "medium") {
      return "border-violet-400/30 bg-violet-500/10 text-violet-300";
    }

    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }

  function getStatusClass(statusValue: string) {
    if (statusValue === "completed") {
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
    }

    if (statusValue === "in_progress") {
      return "border-indigo-400/30 bg-indigo-500/10 text-indigo-300";
    }

    return "border-amber-400/30 bg-amber-500/10 text-amber-300";
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
            Assignments Manager
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Track Academic Tasks
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Add assignments, connect them with subjects, upload PDFs, open AI
            workspaces, write answers, evaluate them, and export PDFs.
          </p>
        </div>

        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200">
          {assignments.length} Total Assignments
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("success")
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/20 bg-red-500/10 text-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Pending"
          value={pendingCount}
          description="Assignments left"
          valueClass="text-amber-300"
        />

        <SummaryCard
          title="Completed"
          value={completedCount}
          description="Tasks finished"
          valueClass="text-emerald-300"
        />

        <SummaryCard
          title="High Priority"
          value={highPriorityCount}
          description="Needs attention"
          valueClass="text-red-400"
        />
      </div>

      <form
        onSubmit={handleAddAssignment}
        className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl md:grid-cols-2"
      >
        <FormInput
          label="Assignment Title"
          placeholder="Example: ML Assignment 1"
          value={title}
          onChange={setTitle}
        />

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Subject
          </label>

          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          >
            {subjects.length === 0 ? (
              <option value="">No subjects found</option>
            ) : (
              subjects.map((subject) => (
                <option
                  key={subject.id || subject._id}
                  value={subject.id || subject._id}
                >
                  {subject.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Due Date
          </label>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Priority
          </label>

          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Status
          </label>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Description
          </label>

          <textarea
            placeholder="Example: Complete K-Means algorithm notes and questions."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || subjects.length === 0}
          className={addButtonClass}
        >
          {loading ? "Adding..." : "Add Assignment"}
        </button>
      </form>

      <div className="mt-7">
        <h3 className="mb-4 text-xl font-black text-white">
          Your Assignments
        </h3>

        {assignments.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-slate-900/50 p-8 text-center text-slate-400">
            No assignments added yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assignments.map((assignment) => {
              const assignmentId = getAssignmentId(assignment);

              return (
                <div
                  key={assignmentId}
                  className="rounded-[1.5rem] border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-black/25 transition duration-300 hover:-translate-y-1 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-black text-white">
                        {assignment.title}
                      </h4>

                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        {getSubjectName(assignment)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getPriorityClass(
                        assignment.priority
                      )}`}
                    >
                      {assignment.priority}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {assignment.details ||
                      assignment.description ||
                      "No description added."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 font-semibold text-slate-300">
                      Due: {assignment.due_date}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 font-semibold capitalize ${getStatusClass(
                        assignment.status
                      )}`}
                    >
                      {assignment.status.replace("_", " ")}
                    </span>

                    {assignment.pdf_filename ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                        PDF uploaded
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-400/20 bg-slate-500/10 px-3 py-1 font-semibold text-slate-300">
                        No PDF
                      </span>
                    )}

                    {(assignment.questions_count || 0) > 0 && (
                      <span className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 font-semibold text-indigo-300">
                        {assignment.questions_count} questions
                      </span>
                    )}

                    {(assignment.answered_count || 0) > 0 && (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
                        {assignment.answered_count} answered
                      </span>
                    )}
                  </div>

                  {editingId === assignmentId && (
                    <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <h5 className="mb-4 font-bold text-emerald-300">
                        Edit Assignment Details
                      </h5>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Title
                          </label>
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Subject
                          </label>
                          <select
                            value={editSubjectId}
                            onChange={(e) => setEditSubjectId(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          >
                            {subjects.map((subject) => (
                              <option
                                key={subject.id || subject._id}
                                value={subject.id || subject._id}
                              >
                                {subject.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Priority
                          </label>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Status
                          </label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-semibold text-slate-200">
                            Description
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleUpdateAssignment(assignmentId)}
                          disabled={loading}
                          className={buttonClass}
                        >
                          {loading ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          onClick={cancelEditAssignment}
                          className={buttonClass}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    <input
                      id={`pdf-upload-${assignmentId}`}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(event) => {
                        handleUploadPdf(
                          assignmentId,
                          event.target.files?.[0]
                        );
                        event.target.value = "";
                      }}
                    />

                    <label
                      htmlFor={`pdf-upload-${assignmentId}`}
                      className={`${buttonClass} cursor-pointer ${
                        uploadingId === assignmentId
                          ? "pointer-events-none opacity-60"
                          : ""
                      }`}
                    >
                      {uploadingId === assignmentId ? "Uploading..." : "Upload PDF"}
                    </label>

                    <button
                      onClick={() => handleDeletePdf(assignmentId)}
                      disabled={!assignment.pdf_filename || deletingPdfId === assignmentId}
                      className={buttonClass}
                    >
                      {deletingPdfId === assignmentId
                        ? "Deleting PDF..."
                        : "Delete PDF"}
                    </button>

                    <button
                      onClick={() => startEditAssignment(assignment)}
                      className={buttonClass}
                    >
                      Edit Details
                    </button>

                    <button
                      onClick={() =>
                        router.push(`/assignments/${assignmentId}/workspace`)
                      }
                      className={buttonClass}
                    >
                      AI Workspace
                    </button>

                    <button
                      onClick={() =>
                        router.push(`/assignments/${assignmentId}/answer`)
                      }
                      className={buttonClass}
                    >
                      Answer Workspace
                    </button>

                    <button
                      onClick={() => handleDeleteAssignment(assignmentId)}
                      className={deleteButtonClass}
                    >
                      Delete Assignment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  description,
  valueClass,
}: {
  title: string;
  value: string | number;
  description: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/25">
      <p className="text-sm text-slate-400">{title}</p>
      <h3 className={`mt-2 text-4xl font-black ${valueClass}`}>{value}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function FormInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-200">
        {label}
      </label>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
      />
    </div>
  );
}