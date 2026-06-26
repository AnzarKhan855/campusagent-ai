"use client";

import PracticeTestAnalytics from "@/components/PracticeTestAnalytics";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Brain,
  FileText,
  Library,
  LogOut,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ArrowRight,
} from "lucide-react";

type User = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
};

type UpcomingAssignment = {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  subject_id: string;
};

type DashboardOverview = {
  total_subjects: number;
  total_assignments: number;
  pending_assignments: number;
  completed_assignments: number;
  overdue_assignments: number;
  overall_attendance: number;
  danger_attendance_count: number;
  total_attendance_records?: number;
  total_classes_held?: number;
  total_classes_attended?: number;
  upcoming_assignments: UpcomingAssignment[];
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const token = localStorage.getItem("campusagent_token");
    const savedUser = localStorage.getItem("campusagent_user");

    if (!token) {
      router.push("/login");
      return;
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("campusagent_user");
      }
    }

    async function fetchDashboardOverview() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to fetch dashboard overview");
        }

        setOverview(data.overview);
      } catch (error) {
        console.error("Dashboard overview error:", error);
        setError("Could not load dashboard overview. Please login again.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardOverview();
  }, [API_BASE_URL, router]);

  function handleLogout() {
    localStorage.removeItem("campusagent_token");
    localStorage.removeItem("campusagent_user");
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-950/95 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
              <GraduationCap className="h-6 w-6 text-blue-400" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                CampusAgent AI
              </h1>
              <p className="text-sm text-slate-400">
                Student productivity and AI study platform
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Dashboard
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            Welcome back, {user?.name || "Student"}
          </h2>

          <p className="mt-3 max-w-3xl text-slate-400">
            Manage subjects, assignments, attendance, AI planning, practice
            tests, weak topics, and RAG-powered PDF study workflows from one
            clean academic workspace.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            Loading dashboard overview...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>
        )}

        {overview && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                title="Total Subjects"
                value={overview.total_subjects}
                description="Subjects you are tracking"
              />

              <StatCard
                icon={<ClipboardList className="h-5 w-5" />}
                title="Pending Assignments"
                value={overview.pending_assignments}
                description={`${overview.completed_assignments} completed`}
              />

              <StatCard
                icon={<CalendarCheck className="h-5 w-5" />}
                title="Overall Attendance"
                value={`${overview.overall_attendance}%`}
                description={`${overview.total_classes_attended || 0}/${
                  overview.total_classes_held || 0
                } classes attended`}
              />

              <StatCard
                icon={<AlertTriangle className="h-5 w-5" />}
                title="Danger Subjects"
                value={overview.danger_attendance_count}
                description="Subjects below required attendance"
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl lg:col-span-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                      Workspace
                    </p>
                    <h3 className="mt-2 text-2xl font-bold">
                      Academic Modules
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Open a module to manage your academic workflow.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200">
                    6 Active Modules
                  </div>
                </div>

                <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <ModuleButton
                    icon={<BookOpen className="h-6 w-6" />}
                    title="Subjects"
                    description="Manage subjects, codes, teachers, and academic details."
                    onClick={() => router.push("/subjects")}
                  />

                  <ModuleButton
                    icon={<ClipboardList className="h-6 w-6" />}
                    title="Assignments"
                    description="Track deadlines, priorities, and completion status."
                    onClick={() => router.push("/assignments")}
                  />

                  <ModuleButton
                    icon={<CalendarCheck className="h-6 w-6" />}
                    title="Attendance"
                    description="Monitor attendance risk and required classes."
                    onClick={() => router.push("/attendance")}
                  />

                  <ModuleButton
                    icon={<Brain className="h-6 w-6" />}
                    title="AI Agent"
                    description="Plan your day using assignment and attendance data."
                    onClick={() => router.push("/ai-command")}
                  />

                  <ModuleButton
                    icon={<FileText className="h-6 w-6" />}
                    title="AI PDF RAG Chat"
                    description="Upload PDFs and ask questions across study material."
                    onClick={() => router.push("/rag-chat")}
                  />

                  <ModuleButton
                    icon={<Library className="h-6 w-6" />}
                    title="PDF Library"
                    description="View, rename, delete, and chat with uploaded PDFs."
                    onClick={() => router.push("/pdf-library")}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                  Deadline Radar
                </p>

                <h3 className="mt-2 text-2xl font-bold">Upcoming Deadline</h3>

                <p className="mt-2 text-sm text-slate-400">
                  Nearest pending assignment
                </p>

                <div className="mt-6">
                  {overview.upcoming_assignments.length > 0 ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
                      <p className="text-xl font-bold text-white">
                        {overview.upcoming_assignments[0].title}
                      </p>

                      <p className="mt-3 text-sm text-slate-300">
                        Due date: {overview.upcoming_assignments[0].due_date}
                      </p>

                      <p className="mt-1 text-sm capitalize text-slate-400">
                        Priority: {overview.upcoming_assignments[0].priority}
                      </p>

                      <button
                        onClick={() => router.push("/assignments")}
                        className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Open Assignments
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-300">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-5 w-5" />
                        No upcoming pending assignments
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <PracticeTestAnalytics />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({
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
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-blue-400">
        {icon}
      </div>

      <p className="mt-5 text-sm text-slate-400">{title}</p>

      <h3 className="mt-2 text-4xl font-bold text-white">{value}</h3>

      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function ModuleButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex h-full min-h-[210px] flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 text-left transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-900"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-blue-400">
        {icon}
      </div>

      <h4 className="mt-5 text-xl font-bold text-white">{title}</h4>

      <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div className="mt-5 flex items-center justify-between text-sm font-semibold text-blue-400">
        <span>Open Module</span>
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </button>
  );
}