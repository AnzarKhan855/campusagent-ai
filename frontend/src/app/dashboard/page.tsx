"use client";

import PracticeTestAnalytics from "@/components/PracticeTestAnalytics";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#14532d_0,#18181b_28%,#09090b_62%,#000000_100%)] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-120px] top-40 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-[-140px] left-1/3 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />
      </div>

      <nav className="relative z-10 border-b border-white/10 bg-black/40 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              CampusAgent{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-white to-violet-300 bg-clip-text text-transparent">
                AI
              </span>
            </h1>
            <p className="text-sm text-zinc-400">
              Agentic student productivity dashboard
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400/60 hover:bg-red-500/20"
          >
            Logout
          </button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950/95 via-neutral-950 to-emerald-950/25 p-7 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
            Welcome Back
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight">
            {user?.name || "Student"} 👋
          </h2>

          <p className="mt-3 max-w-2xl text-zinc-300">
            Track subjects, assignments, attendance risks, AI planning, practice
            tests, weak topics, and upcoming academic workload from one focused
            student productivity dashboard.
          </p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-zinc-300">
            Loading dashboard overview...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            {error}
          </div>
        )}

        {overview && (
          <>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Total Subjects"
                value={overview.total_subjects}
                description="Subjects you are tracking"
                accent="text-emerald-300"
                glow="bg-emerald-500/10"
              />

              <StatCard
                title="Pending Assignments"
                value={overview.pending_assignments}
                description={`${overview.completed_assignments} completed`}
                accent="text-violet-300"
                glow="bg-violet-500/10"
              />

              <StatCard
                title="Overall Attendance"
                value={`${overview.overall_attendance}%`}
                description={`${overview.total_classes_attended || 0}/${
                  overview.total_classes_held || 0
                } classes attended`}
                accent="text-white"
                glow="bg-white/10"
              />

              <StatCard
                title="Danger Subjects"
                value={overview.danger_attendance_count}
                description="Subjects below required attendance"
                accent="text-red-400"
                glow="bg-red-500/15"
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 shadow-2xl shadow-black/40 lg:col-span-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
                      Student OS
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      Academic Modules
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      Open any module to manage your academic workflow.
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                    4 Active Modules
                  </div>
                </div>

                <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <ModuleButton
                    icon="📚"
                    title="Subjects"
                    description="Manage subjects, codes, teachers and colors."
                    accent="emerald"
                    onClick={() => router.push("/subjects")}
                  />

                  <ModuleButton
                    icon="📝"
                    title="Assignments"
                    description="Track deadlines, priorities and completion status."
                    accent="violet"
                    onClick={() => router.push("/assignments")}
                  />

                  <ModuleButton
                    icon="📊"
                    title="Attendance"
                    description="Monitor risk, danger subjects and classes needed."
                    accent="red"
                    onClick={() => router.push("/attendance")}
                  />

                  <ModuleButton
                    icon="🤖"
                    title="AI Agent"
                    description="Plan your day using assignments and attendance data."
                    accent="emerald"
                    onClick={() => router.push("/ai-command")}
                  />
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 shadow-2xl shadow-black/40">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                  Deadline Radar
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  Upcoming Deadline
                </h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Nearest pending assignment
                </p>

                <div className="mt-6">
                  {overview.upcoming_assignments.length > 0 ? (
                    <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
                      <p className="text-xl font-black text-violet-100">
                        {overview.upcoming_assignments[0].title}
                      </p>

                      <p className="mt-3 text-sm text-zinc-300">
                        Due date: {overview.upcoming_assignments[0].due_date}
                      </p>

                      <p className="mt-1 text-sm capitalize text-zinc-400">
                        Priority: {overview.upcoming_assignments[0].priority}
                      </p>

                      <button
                        onClick={() => router.push("/assignments")}
                        className="mt-5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
                      >
                        Open Assignments →
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-emerald-200">
                      No upcoming pending assignments 🎉
                    </div>
                  )}
                </div>
              </div>
            </div>

            <PracticeTestAnalytics />
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  accent,
  glow,
}: {
  title: string;
  value: string | number;
  description: string;
  accent: string;
  glow: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/70 p-6 shadow-xl shadow-black/35 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-900/70">
      <div
        className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${glow} blur-2xl transition group-hover:scale-125`}
      />

      <div className="relative z-10">
        <p className="text-sm text-zinc-400">{title}</p>
        <h3 className={`mt-3 text-4xl font-black ${accent}`}>{value}</h3>
        <p className="mt-3 text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

function ModuleButton({
  icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  accent: "emerald" | "violet" | "red";
  onClick: () => void;
}) {
  const styles = {
    emerald: {
      border: "hover:border-emerald-400/50",
      text: "text-emerald-300",
      bg: "group-hover:bg-emerald-500/10",
      icon: "bg-emerald-500/10",
    },
    violet: {
      border: "hover:border-violet-400/50",
      text: "text-violet-300",
      bg: "group-hover:bg-violet-500/10",
      icon: "bg-violet-500/10",
    },
    red: {
      border: "hover:border-red-400/60",
      text: "text-red-400",
      bg: "group-hover:bg-red-500/10",
      icon: "bg-red-500/10",
    },
  };

  return (
    <button
      onClick={onClick}
      className={`group rounded-[1.5rem] border border-white/10 bg-black/30 p-5 text-left shadow-lg transition duration-300 hover:-translate-y-1 ${styles[accent].border} ${styles[accent].bg}`}
    >
      <div
        className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 ${styles[accent].icon} text-2xl`}
      >
        {icon}
      </div>

      <h4 className="text-xl font-black text-white">{title}</h4>

      <p className="mt-2 min-h-[66px] text-sm leading-6 text-zinc-400">
        {description}
      </p>

      <div className="mt-5 flex items-center justify-between">
        <span className={`text-sm font-semibold ${styles[accent].text}`}>
          Open Module
        </span>

        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition group-hover:translate-x-1">
          →
        </span>
      </div>
    </button>
  );
}