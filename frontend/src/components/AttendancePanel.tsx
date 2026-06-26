"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

type Subject = {
  id: string;
  name: string;
  code?: string;
  teacher?: string;
  color?: string;
};

type AttendanceRecord = {
  id: string;
  subject_id: string;
  subject_name: string;
  total_classes: number;
  attended_classes: number;
  required_percentage: number;
  current_percentage: number;
  risk_status: string;
  classes_can_miss: number;
  classes_needed: number | null;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function AttendancePanel() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [subjectId, setSubjectId] = useState("");
  const [totalClasses, setTotalClasses] = useState("");
  const [attendedClasses, setAttendedClasses] = useState("");
  const [requiredPercentage, setRequiredPercentage] = useState("75");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editTotalClasses, setEditTotalClasses] = useState("");
  const [editAttendedClasses, setEditAttendedClasses] = useState("");
  const [editRequiredPercentage, setEditRequiredPercentage] = useState("75");

  function getToken() {
    return localStorage.getItem("campusagent_token");
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
        setSubjectId(userSubjects[0].id);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while fetching subjects."
      );
    }
  }

  async function fetchAttendanceRecords() {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch attendance records");
      }

      setAttendanceRecords(data.attendance || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while fetching attendance."
      );
    }
  }

  useEffect(() => {
    fetchSubjects();
    fetchAttendanceRecords();
  }, []);

  async function handleAddAttendance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    if (!subjectId) {
      setMessage("Please select a subject.");
      return;
    }

    const total = Number(totalClasses);
    const attended = Number(attendedClasses);
    const required = Number(requiredPercentage);

    if (
      Number.isNaN(total) ||
      Number.isNaN(attended) ||
      Number.isNaN(required)
    ) {
      setMessage("Please enter valid numbers.");
      return;
    }

    if (total < 0 || attended < 0) {
      setMessage("Classes cannot be negative.");
      return;
    }

    if (required <= 0 || required > 100) {
      setMessage("Required percentage must be between 1 and 100.");
      return;
    }

    if (attended > total) {
      setMessage("Attended classes cannot be greater than classes held.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject_id: subjectId,
          total_classes: total,
          attended_classes: attended,
          required_percentage: required,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to add attendance");
      }

      setAttendanceRecords((prev) => [data.attendance, ...prev]);

      setTotalClasses("");
      setAttendedClasses("");
      setRequiredPercentage("75");
      setMessage("Attendance added successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while adding attendance."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateAttendance(
    record: AttendanceRecord,
    total: number,
    attended: number,
    required: number = record.required_percentage
  ) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_classes: total,
          attended_classes: attended,
          required_percentage: required,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update attendance");
      }

      setAttendanceRecords((prev) =>
        prev.map((item) => (item.id === record.id ? data.attendance : item))
      );

      setMessage("Attendance updated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating attendance."
      );
    }
  }

  async function handleAttended(record: AttendanceRecord) {
    await updateAttendance(
      record,
      record.total_classes + 1,
      record.attended_classes + 1
    );
  }

  async function handleMissed(record: AttendanceRecord) {
    await updateAttendance(
      record,
      record.total_classes + 1,
      record.attended_classes
    );
  }

  function startEditing(record: AttendanceRecord) {
    setEditingId(record.id);
    setEditTotalClasses(String(record.total_classes));
    setEditAttendedClasses(String(record.attended_classes));
    setEditRequiredPercentage(String(record.required_percentage));
    setMessage("");
  }

  function cancelEditing() {
    setEditingId("");
    setEditTotalClasses("");
    setEditAttendedClasses("");
    setEditRequiredPercentage("75");
  }

  async function handleSaveEdit(record: AttendanceRecord) {
    const total = Number(editTotalClasses);
    const attended = Number(editAttendedClasses);
    const required = Number(editRequiredPercentage);

    if (
      Number.isNaN(total) ||
      Number.isNaN(attended) ||
      Number.isNaN(required)
    ) {
      setMessage("Please enter valid numbers.");
      return;
    }

    if (total < 0 || attended < 0) {
      setMessage("Classes cannot be negative.");
      return;
    }

    if (attended > total) {
      setMessage("Attended classes cannot be greater than classes held.");
      return;
    }

    if (required <= 0 || required > 100) {
      setMessage("Required percentage must be between 1 and 100.");
      return;
    }

    await updateAttendance(record, total, attended, required);
    cancelEditing();
  }

  async function handleDeleteAttendance(attendanceId: string) {
    const token = getToken();

    if (!token) {
      setMessage("Please login again.");
      return;
    }

    const confirmed = confirm("Delete this attendance record?");
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/${attendanceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to delete attendance");
      }

      setAttendanceRecords((prev) =>
        prev.filter((record) => record.id !== attendanceId)
      );

      if (editingId === attendanceId) {
        cancelEditing();
      }

      setMessage("Attendance deleted successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while deleting attendance."
      );
    }
  }

  const totalHeldOverall = attendanceRecords.reduce(
    (sum, record) => sum + record.total_classes,
    0
  );

  const totalAttendedOverall = attendanceRecords.reduce(
    (sum, record) => sum + record.attended_classes,
    0
  );

  const dangerSubjects = attendanceRecords.filter(
    (record) => record.risk_status === "danger"
  ).length;

  const overallPercentage =
    totalHeldOverall > 0
      ? Math.round((totalAttendedOverall / totalHeldOverall) * 10000) / 100
      : 0;

  let overallRisk = "safe";

  if (overallPercentage < 75) {
    overallRisk = "danger";
  } else if (overallPercentage < 85) {
    overallRisk = "warning";
  }

  const attendanceChartData = attendanceRecords.map((record) => ({
    subject: record.subject_name,
    percentage: record.current_percentage,
  }));

  function getRiskClass(risk: string) {
    if (risk === "safe") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (risk === "warning") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    }

    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  function getProgressColor(risk: string) {
    if (risk === "safe") return "bg-emerald-500";
    if (risk === "warning") return "bg-amber-500";
    return "bg-red-500";
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xl">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Attendance
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Attendance Risk Overview
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Track subject-wise attendance and understand how many classes you
            can miss or need to attend.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          {dangerSubjects} Risk Subjects
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          title="Overall Attendance"
          value={`${overallPercentage}%`}
          description={overallRisk}
          valueClass={
            overallRisk === "danger"
              ? "text-red-400"
              : overallRisk === "warning"
              ? "text-amber-300"
              : "text-emerald-300"
          }
        />

        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Total Attended"
          value={totalAttendedOverall}
          description="Across all subjects"
          valueClass="text-white"
        />

        <SummaryCard
          icon={<CalendarCheck className="h-5 w-5" />}
          title="Classes Held"
          value={totalHeldOverall}
          description="Only when class happens"
          valueClass="text-white"
        />

        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Danger Subjects"
          value={dangerSubjects}
          description="Below required attendance"
          valueClass="text-red-400"
        />
      </div>

      {attendanceRecords.length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">
              Subject-wise Attendance Graph
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Visual comparison of your attendance percentage across subjects.
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="subject" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    color: "#ffffff",
                  }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#93c5fd" }}
                />
                <Bar
                  dataKey="percentage"
                  name="Attendance %"
                  fill="#2563eb"
                  radius={[8, 8, 0, 0]}
                  activeBar={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <form
        onSubmit={handleAddAttendance}
        className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <h3 className="text-lg font-bold text-white">Add Attendance Record</h3>
          <p className="mt-1 text-sm text-slate-400">
            Add initial subject-wise attendance. Use edit later for corrections.
          </p>
        </div>

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
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))
            )}
          </select>
        </InputGroup>

        <InputGroup label="Required Percentage">
          <input
            type="number"
            placeholder="75"
            value={requiredPercentage}
            onChange={(e) => setRequiredPercentage(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
        </InputGroup>

        <InputGroup label="Classes Held So Far">
          <input
            type="number"
            placeholder="Example: 20"
            value={totalClasses}
            onChange={(e) => setTotalClasses(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
        </InputGroup>

        <InputGroup label="Classes You Attended">
          <input
            type="number"
            placeholder="Example: 16"
            value={attendedClasses}
            onChange={(e) => setAttendedClasses(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
        </InputGroup>

        <button
          type="submit"
          disabled={loading || subjects.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Adding..." : "Add Attendance"}
        </button>
      </form>

      <div className="mt-7">
        <h3 className="mb-4 text-xl font-bold text-white">Your Attendance</h3>

        {attendanceRecords.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center text-slate-400">
            No attendance records added yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {attendanceRecords.map((record) => (
              <div
                key={record.id}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-500/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-white">
                      {record.subject_name}
                    </h4>
                    <p className="mt-1 text-sm text-slate-400">
                      {record.attended_classes} attended /{" "}
                      {record.total_classes} held
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getRiskClass(
                      record.risk_status
                    )}`}
                  >
                    {record.risk_status}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Attendance</span>
                    <span className="font-bold text-white">
                      {record.current_percentage}%
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${getProgressColor(
                        record.risk_status
                      )}`}
                      style={{
                        width: `${Math.min(record.current_percentage, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-slate-400">Can Miss</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {record.classes_can_miss}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-slate-400">Need Attend</p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {record.classes_needed ?? 0}
                    </p>
                  </div>
                </div>

                {editingId === record.id ? (
                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <EditInput
                        label="Classes Held"
                        value={editTotalClasses}
                        onChange={setEditTotalClasses}
                      />

                      <EditInput
                        label="Classes Attended"
                        value={editAttendedClasses}
                        onChange={setEditAttendedClasses}
                      />

                      <EditInput
                        label="Required %"
                        value={editRequiredPercentage}
                        onChange={setEditRequiredPercentage}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(record)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Save Changes
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAttended(record)}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Attended
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMissed(record)}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      <Clock className="h-4 w-4" />
                      Mark Missed
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditing(record)}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAttendance(record.id)}
                      className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
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
  valueClass,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  description: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
        {icon}
      </div>

      <p className="mt-4 text-sm text-slate-400">{title}</p>
      <h3 className={`mt-2 text-4xl font-bold ${valueClass}`}>{value}</h3>
      <p className="mt-2 text-sm capitalize text-slate-500">{description}</p>
    </div>
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
    <div>
      <label className="mb-2 block text-xs font-semibold text-slate-400">
        {label}
      </label>

      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition focus:border-blue-500"
      />
    </div>
  );
}