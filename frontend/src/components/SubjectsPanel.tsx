"use client";

import { useEffect, useState } from "react";

type Subject = {
  id: string;
  name: string;
  code?: string | null;
  teacher?: string | null;
  color?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const colorStyles: Record<
  string,
  {
    badge: string;
    dot: string;
    border: string;
  }
> = {
  blue: {
    badge: "border-indigo-400/30 bg-indigo-500/10 text-indigo-200",
    dot: "bg-indigo-400",
    border: "hover:border-indigo-400/40",
  },
  emerald: {
    badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
    border: "hover:border-emerald-400/40",
  },
  purple: {
    badge: "border-violet-400/30 bg-violet-500/10 text-violet-200",
    dot: "bg-violet-400",
    border: "hover:border-violet-400/40",
  },
  orange: {
    badge: "border-orange-400/30 bg-orange-500/10 text-orange-200",
    dot: "bg-orange-400",
    border: "hover:border-orange-400/40",
  },
  red: {
    badge: "border-red-400/30 bg-red-500/10 text-red-200",
    dot: "bg-red-400",
    border: "hover:border-red-400/40",
  },
};

export default function SubjectsPanel() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacher, setTeacher] = useState("");
  const [color, setColor] = useState("emerald");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("campusagent_token");
  };

  const fetchSubjects = async () => {
    try {
      const token = getToken();

      if (!token) {
        setMessage("Login token not found. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/subjects`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to fetch subjects");
        return;
      }

      setSubjects(data.subjects || []);
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while fetching subjects.");
    }
  };

  const addSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      setMessage("Subject name is required.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Login token not found. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          code,
          teacher,
          color,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to add subject");
        return;
      }

      setName("");
      setCode("");
      setTeacher("");
      setColor("emerald");
      setMessage("Subject added successfully.");

      await fetchSubjects();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while adding subject.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSubject = async (subjectId: string) => {
    try {
      const token = getToken();

      if (!token) {
        setMessage("Login token not found. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/subjects/${subjectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Failed to delete subject");
        return;
      }

      setMessage("Subject deleted successfully.");
      await fetchSubjects();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while deleting subject.");
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
            Academic Workspace
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Subjects
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Add and manage your semester subjects. Assignments, attendance,
            notes and AI study plans will connect with these subjects.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          {subjects.length} Subjects Added
        </div>
      </div>

      <form
        onSubmit={addSubject}
        className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Subject Name
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Example: Machine Learning"
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Subject Code
          </label>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Example: AIML401"
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Teacher
          </label>

          <input
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="Example: Dr. Sharma"
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Color
          </label>

          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="emerald">Emerald</option>
            <option value="blue">Indigo</option>
            <option value="purple">Violet</option>
            <option value="orange">Orange</option>
            <option value="red">Red</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-5 py-3 font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:scale-[1.02] hover:shadow-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Adding..." : "Add Subject"}
          </button>
        </div>
      </form>

      {message && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            message.toLowerCase().includes("success")
              ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/20 bg-red-500/10 text-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-7">
        {subjects.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-slate-900/50 p-8 text-center">
            <p className="text-lg font-bold text-white">No subjects added yet</p>
            <p className="mt-2 text-sm text-slate-400">
              Add your first subject to start building your academic dashboard.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => {
              const selectedColor =
                colorStyles[subject.color || "emerald"] || colorStyles.emerald;

              return (
                <div
                  key={subject.id}
                  className={`group rounded-[1.5rem] border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-black/25 transition duration-300 hover:-translate-y-1 hover:bg-slate-900 ${selectedColor.border}`}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${selectedColor.dot}`}
                        />

                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                          {subject.code || "No Code"}
                        </p>
                      </div>

                      <h3 className="mt-3 text-xl font-black text-white">
                        {subject.name}
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        {subject.teacher || "Teacher not added"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${selectedColor.badge}`}
                    >
                      {subject.color || "emerald"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <p className="text-xs text-slate-500">
                      Connected to assignments & attendance
                    </p>

                    <button
                      type="button"
                      onClick={() => deleteSubject(subject.id)}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                    >
                      Delete
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