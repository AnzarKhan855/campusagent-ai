"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type User = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
};

type AIAssignment = {
  title: string;
  subject: string;
  due_date: string;
  priority: string;
  status: string;
  days_left: number | null;
};

type AIAgentResponse = {
  success: boolean;
  agent_type: string;
  command: string;
  answer?: string;
  plan?: {
    todays_priority: string;
    urgent_assignments: AIAssignment[];
    overdue_assignments: AIAssignment[];
    attendance_danger_warning: unknown[];
    suggested_study_order: string[];
    short_motivation: string;
  };
  summary?: {
    total_subjects: number;
    pending_assignments: number;
    urgent_assignments: number;
    overdue_assignments: number;
    danger_attendance_subjects: number;
  };
};

export default function AICommandPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [aiCommand, setAiCommand] = useState("Plan my day");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<AIAgentResponse | null>(null);

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
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("campusagent_token");
    localStorage.removeItem("campusagent_user");
    router.push("/login");
  }

  async function handleRunAIAgent() {
    try {
      setAiLoading(true);
      setAiError("");
      setAiResult(null);

      const token = localStorage.getItem("campusagent_token");

      if (!token) {
        setAiError("Login token not found. Please logout and login again.");
        router.push("/login");
        return;
      }

      const command = aiCommand.trim();

      if (!command) {
        setAiError("Please enter a command first.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command }),
      });

      const text = await response.text();

      let data: Partial<AIAgentResponse> & {
        detail?: string;
        message?: string;
      } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Invalid response from backend.");
      }

      if (!response.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : data.message || "AI Agent request failed";

        if (
          response.status === 401 ||
          response.status === 403 ||
          message.toLowerCase().includes("could not validate token")
        ) {
          localStorage.removeItem("campusagent_token");
          localStorage.removeItem("campusagent_user");
          router.push("/login");
          return;
        }

        throw new Error(message);
      }

      setAiResult(data as AIAgentResponse);
    } catch (error) {
      console.error("AI Agent Error:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : "Something went wrong while running AI Agent."
      );
    } finally {
      setAiLoading(false);
    }
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
              AI Command Box · Hybrid Academic Agent
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400/60 hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950/95 via-neutral-950 to-emerald-950/25 p-7 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
            Agent Workspace
          </p>

          <h2 className="mt-3 text-4xl font-black tracking-tight">
            AI Command Box
          </h2>

          <p className="mt-3 max-w-3xl text-zinc-300">
            Hi {user?.name || "Student"}, ask CampusAgent AI to plan your day,
            guide assignment preparation, explain topics, or suggest what to
            study first.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/75 p-6 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">
                Run Agent
              </p>

              <h3 className="mt-2 text-2xl font-black">Command Input</h3>

              <p className="mt-2 max-w-3xl text-zinc-400">
                Try “Plan my day” for structured planning, or ask assignment
                help like “How should I complete my Data Analytics assignment?”
              </p>
            </div>

            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              Rule-Based + Groq LLM
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={aiCommand}
              onChange={(event) => setAiCommand(event.target.value)}
              placeholder="Ask anything academic..."
              className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60 focus:bg-black/60"
            />

            <button
              onClick={handleRunAIAgent}
              disabled={aiLoading}
              className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-zinc-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? "Running Agent..." : "Run AI Agent"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <PromptButton
              label="Plan my day"
              onClick={() => setAiCommand("Plan my day")}
            />
            <PromptButton
              label="Help with DA assignment"
              onClick={() =>
                setAiCommand(
                  "How should I complete my Data Analytics assignment?"
                )
              }
            />
            <PromptButton
              label="Study priority"
              onClick={() =>
                setAiCommand("Which assignment should I complete first and why?")
              }
            />
            <PromptButton
              label="Attendance risk"
              onClick={() =>
                setAiCommand(
                  "Check my attendance risk and suggest what I should do."
                )
              }
            />
          </div>

          {aiError && (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300">
              {aiError}
            </div>
          )}

          {aiResult?.answer && (
            <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-black/30 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                    AI Response
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Agent Type: {aiResult.agent_type}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200">
                  Groq LLM
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-zinc-200">
                {renderAIAnswer(aiResult.answer)}
              </div>
            </div>
          )}

          {aiResult?.plan && aiResult?.summary && (
            <div className="mt-7 space-y-5">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  Today&apos;s Priority
                </p>

                <p className="mt-3 text-xl font-black text-white">
                  {aiResult.plan.todays_priority}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <h4 className="text-lg font-black text-emerald-300">
                    Urgent Assignments
                  </h4>

                  {aiResult.plan.urgent_assignments.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {aiResult.plan.urgent_assignments.map(
                        (assignment, index) => (
                          <div
                            key={`${assignment.title}-${index}`}
                            className="rounded-xl border border-emerald-400/15 bg-emerald-500/10 p-4"
                          >
                            <p className="font-bold text-white">
                              {assignment.title}
                            </p>

                            <p className="mt-1 text-sm text-zinc-300">
                              {assignment.subject} • Due:{" "}
                              {assignment.due_date}
                            </p>

                            <p className="mt-2 text-xs font-semibold capitalize text-emerald-300">
                              {assignment.days_left ?? "No"} days left •{" "}
                              {assignment.priority} priority •{" "}
                              {assignment.status}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-400">
                      No urgent assignments right now.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <h4 className="text-lg font-black text-red-400">
                    Overdue Assignments
                  </h4>

                  {aiResult.plan.overdue_assignments.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {aiResult.plan.overdue_assignments.map(
                        (assignment, index) => (
                          <div
                            key={`${assignment.title}-${index}`}
                            className="rounded-xl border border-red-500/25 bg-red-500/10 p-4"
                          >
                            <p className="font-bold text-white">
                              {assignment.title}
                            </p>

                            <p className="mt-1 text-sm text-red-200">
                              {assignment.subject} • Due:{" "}
                              {assignment.due_date}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-zinc-400">
                      No overdue assignments. Nice.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-black/30 p-5">
                <h4 className="text-lg font-black text-red-400">
                  Attendance Danger Warning
                </h4>

                {aiResult.plan.attendance_danger_warning.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {aiResult.plan.attendance_danger_warning.map(
                      (warning, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                          {formatWarning(warning)}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-400">
                    No attendance danger warning right now.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-violet-400/20 bg-black/30 p-5">
                <h4 className="text-lg font-black text-violet-300">
                  Suggested Study Order
                </h4>

                {aiResult.plan.suggested_study_order.length > 0 ? (
                  <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-zinc-300">
                    {aiResult.plan.suggested_study_order.map((task, index) => (
                      <li key={index}>{task}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-zinc-400">
                    No study order generated.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="text-sm font-semibold text-emerald-200">
                  {aiResult.plan.short_motivation}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MiniStat
                  label="Subjects"
                  value={aiResult.summary.total_subjects}
                  accent="text-white"
                />

                <MiniStat
                  label="Pending"
                  value={aiResult.summary.pending_assignments}
                  accent="text-violet-300"
                />

                <MiniStat
                  label="Urgent"
                  value={aiResult.summary.urgent_assignments}
                  accent="text-emerald-300"
                />

                <MiniStat
                  label="Overdue"
                  value={aiResult.summary.overdue_assignments}
                  accent="text-red-400"
                />

                <MiniStat
                  label="Danger Attendance"
                  value={aiResult.summary.danger_attendance_subjects}
                  accent="text-red-400"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function PromptButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
    >
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>

      <p className={`mt-3 text-3xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function renderAIAnswer(answer: string) {
  return answer.split("\n").map((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return <div key={index} className="h-2" />;
    }

    const cleanLine = trimmedLine.replaceAll("**", "");

    if (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")) {
      return (
        <h4 key={index} className="pt-3 text-lg font-black text-white">
          {cleanLine}
        </h4>
      );
    }

    if (
      trimmedLine.startsWith("* ") ||
      trimmedLine.startsWith("- ") ||
      trimmedLine.startsWith("+ ")
    ) {
      return (
        <p key={index} className="pl-4 text-zinc-300">
          • {cleanLine.slice(2)}
        </p>
      );
    }

    if (
      trimmedLine.startsWith("• ") ||
      trimmedLine.startsWith("→ ") ||
      trimmedLine.startsWith("-")
    ) {
      return (
        <p key={index} className="pl-4 text-zinc-300">
          {cleanLine}
        </p>
      );
    }

    return (
      <p key={index} className="text-zinc-300">
        {cleanLine}
      </p>
    );
  });
}

function formatWarning(warning: unknown) {
  if (typeof warning === "string") {
    return warning;
  }

  if (typeof warning === "object" && warning !== null) {
    const item = warning as {
      subject?: string;
      attendance_percentage?: number;
      required_percentage?: number;
      classes_held?: number;
      classes_attended?: number;
    };

    if (item.subject) {
      return `${item.subject}: ${item.attendance_percentage}% attendance, required ${item.required_percentage}%. Attended ${item.classes_attended}/${item.classes_held} classes.`;
    }
  }

  return JSON.stringify(warning);
}