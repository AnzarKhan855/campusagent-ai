"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  FolderOpen,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("pending");

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
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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

    if (!file) return;

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
          headers: { Authorization: `Bearer ${token}` },
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

    if (!confirmDelete) return;

    try {
      setDeletingPdfId(assignmentId);
      setMessage("");

      const res = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/delete-pdf`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
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
      setOpenMenuId(null);
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
    setOpenMenuId(null);
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

    const confirmDelete = window.confirm("Delete this assignment permanently?");

    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete assignment");
      }

      setAssignments((prev) =>
        prev.filter((assignment) => getAssignmentId(assignment) !== assignmentId)
      );

      setOpenMenuId(null);
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
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    if (priorityValue === "medium") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    }

    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  function getStatusClass(statusValue: string) {
    if (statusValue === "completed") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (statusValue === "in_progress") {
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    }

    return "border-slate-700 bg-slate-900 text-slate-300";
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Assignments
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Academic Task Manager
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Manage assignments, deadlines, PDF question banks, AI workspaces,
            and answer evaluation from one clean workflow.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300">
          <ClipboardList className="h-4 w-4 text-blue-400" />
          {assignments.length} Total Assignments
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("success")
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Pending"
          value={pendingCount}
          description="Assignments left"
        />

        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Completed"
          value={completedCount}
          description="Tasks finished"
        />

        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="High Priority"
          value={highPriorityCount}
          description="Needs attention"
        />
      </div>

      <form
        onSubmit={handleAddAssignment}
        className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <h3 className="text-lg font-bold text-white">Add Assignment</h3>
          <p className="mt-1 text-sm text-slate-400">
            Create a new academic task and optionally attach a PDF later.
          </p>
        </div>

        <FormInput
          label="Assignment Title"
          placeholder="Example: ML Assignment 1"
          value={title}
          onChange={setTitle}
        />

        <InputGroup label="Subject">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
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
        </InputGroup>

        <InputGroup label="Due Date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          />
        </InputGroup>

        <InputGroup label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </InputGroup>

        <InputGroup label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </InputGroup>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            Description
          </label>

          <textarea
            placeholder="Example: Complete K-Means algorithm notes and questions."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || subjects.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Adding..." : "Add Assignment"}
        </button>
      </form>

      <div className="mt-7">
        <h3 className="mb-4 text-xl font-bold text-white">Your Assignments</h3>

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            No assignments added yet.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {assignments.map((assignment) => {
              const assignmentId = getAssignmentId(assignment);
              const isMenuOpen = openMenuId === assignmentId;
              const hasPdf = Boolean(assignment.pdf_filename || assignment.has_pdf);

              return (
                <div
                  key={assignmentId}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-500/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="break-words text-lg font-bold text-white">
                        {assignment.title}
                      </h4>

                      <p className="mt-1 text-sm font-semibold text-blue-400">
                        {getSubjectName(assignment)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(isMenuOpen ? null : assignmentId)
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {isMenuOpen && (
                    <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <MenuButton
                          icon={<Edit3 className="h-4 w-4" />}
                          label="Edit Details"
                          onClick={() => startEditAssignment(assignment)}
                        />

                        <label
                          htmlFor={`pdf-upload-${assignmentId}`}
                          className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          <Upload className="h-4 w-4" />
                          {uploadingId === assignmentId
                            ? "Uploading PDF..."
                            : hasPdf
                            ? "Replace PDF"
                            : "Upload PDF"}
                        </label>

                        <MenuButton
                          icon={<Trash2 className="h-4 w-4" />}
                          label={
                            !hasPdf
                              ? "No PDF to Delete"
                              : deletingPdfId === assignmentId
                              ? "Deleting PDF..."
                              : "Delete PDF"
                          }
                          disabled={!hasPdf || deletingPdfId === assignmentId}
                          onClick={() => handleDeletePdf(assignmentId)}
                        />

                        <MenuButton
                          danger
                          icon={<Trash2 className="h-4 w-4" />}
                          label="Delete Assignment"
                          onClick={() => handleDeleteAssignment(assignmentId)}
                        />
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {assignment.details ||
                      assignment.description ||
                      "No description added."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                      Due: {assignment.due_date}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 font-semibold capitalize ${getPriorityClass(
                        assignment.priority
                      )}`}
                    >
                      {assignment.priority}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 font-semibold capitalize ${getStatusClass(
                        assignment.status
                      )}`}
                    >
                      {assignment.status.replace("_", " ")}
                    </span>

                    {hasPdf ? (
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-semibold text-blue-300">
                        PDF uploaded
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                        No PDF
                      </span>
                    )}

                    {(assignment.questions_count || 0) > 0 && (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                        {assignment.questions_count} questions
                      </span>
                    )}

                    {(assignment.answered_count || 0) > 0 && (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                        {assignment.answered_count} answered
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/assignments/${assignmentId}/workspace`)
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <FolderOpen className="h-4 w-4" />
                      AI Workspace
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/assignments/${assignmentId}/answer`)
                      }
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      <FileText className="h-4 w-4" />
                      Answer Workspace
                    </button>
                  </div>

                  <input
                    id={`pdf-upload-${assignmentId}`}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      handleUploadPdf(assignmentId, event.target.files?.[0]);
                      event.target.value = "";
                      setOpenMenuId(null);
                    }}
                  />

                  {editingId === assignmentId && (
                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <h5 className="font-bold text-white">
                          Edit Assignment Details
                        </h5>

                        <button
                          type="button"
                          onClick={cancelEditAssignment}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <EditInput
                          label="Title"
                          value={editTitle}
                          onChange={setEditTitle}
                        />

                        <InputGroup label="Subject">
                          <select
                            value={editSubjectId}
                            onChange={(e) => setEditSubjectId(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
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
                        </InputGroup>

                        <InputGroup label="Due Date">
                          <input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                          />
                        </InputGroup>

                        <InputGroup label="Priority">
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </InputGroup>

                        <InputGroup label="Status">
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </InputGroup>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-semibold text-slate-300">
                            Description
                          </label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleUpdateAssignment(assignmentId)}
                          disabled={loading}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {loading ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEditAssignment}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
  icon,
  title,
  value,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
        {icon}
      </div>
      <p className="mt-4 text-sm text-slate-400">{title}</p>
      <h3 className="mt-2 text-4xl font-bold text-white">{value}</h3>
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
    <InputGroup label={label}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
      />
    </InputGroup>
  );
}

function EditInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputGroup label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
      />
    </InputGroup>
  );
}

function InputGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "text-red-300 hover:bg-red-500/10"
          : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}