"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LogOut,
  MessageSquareText,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

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
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-950 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
              <Bot className="h-6 w-6 text-blue-400" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                CampusAgent AI
              </h1>
              <p className="text-sm text-slate-400">
                AI command workspace
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            Agent Workspace
          </p>

          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            AI Command Box
          </h2>

          <p className="mt-3 max-w-3xl text-slate-400">
            Hi {user?.name || "Student"}, ask CampusAgent AI to plan your day,
            check academic priorities, summarize assignment urgency, or suggest
            what to study first.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                Run Agent
              </p>

              <h3 className="mt-2 text-2xl font-bold">Command Input</h3>

              <p className="mt-2 max-w-3xl text-slate-400">
                Try “Plan my day”, “Which assignment should I complete first?”,
                or “Check my attendance risk.”
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300">
              <Brain className="h-4 w-4 text-blue-400" />
              Rule-Based + Groq
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={aiCommand}
              onChange={(event) => setAiCommand(event.target.value)}
              placeholder="Ask anything academic..."
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <button
              onClick={handleRunAIAgent}
              disabled={aiLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
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
            <div className="mt-7 rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
                    AI Response
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Agent Type: {aiResult.agent_type}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300">
                  <MessageSquareText className="h-4 w-4 text-blue-400" />
                  Groq LLM
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-300">
                {renderAIAnswer(aiResult.answer)}
              </div>
            </div>
          )}

          {aiResult?.plan && aiResult?.summary && (
            <div className="mt-7 space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
                  Today&apos;s Priority
                </p>

                <p className="mt-3 text-xl font-bold text-white">
                  {aiResult.plan.todays_priority}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                    <ClipboardList className="h-5 w-5 text-blue-400" />
                    Urgent Assignments
                  </h4>

                  {aiResult.plan.urgent_assignments.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {aiResult.plan.urgent_assignments.map(
                        (assignment, index) => (
                          <div
                            key={`${assignment.title}-${index}`}
                            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                          >
                            <p className="font-bold text-white">
                              {assignment.title}
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                              {assignment.subject} · Due:{" "}
                              {assignment.due_date}
                            </p>

                            <p className="mt-2 text-xs font-semibold capitalize text-blue-400">
                              {assignment.days_left ?? "No"} days left ·{" "}
                              {assignment.priority} priority ·{" "}
                              {assignment.status}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      No urgent assignments right now.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                  <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                    <TriangleAlert className="h-5 w-5 text-red-400" />
                    Overdue Assignments
                  </h4>

                  {aiResult.plan.overdue_assignments.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {aiResult.plan.overdue_assignments.map(
                        (assignment, index) => (
                          <div
                            key={`${assignment.title}-${index}`}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
                          >
                            <p className="font-bold text-white">
                              {assignment.title}
                            </p>

                            <p className="mt-1 text-sm text-red-200">
                              {assignment.subject} · Due:{" "}
                              {assignment.due_date}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      No overdue assignments.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                  <CalendarClock className="h-5 w-5 text-blue-400" />
                  Attendance Risk
                </h4>

                {aiResult.plan.attendance_danger_warning.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {aiResult.plan.attendance_danger_warning.map(
                      (warning, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
                        >
                          {formatWarning(warning)}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    No attendance risk warnings right now.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h4 className="text-lg font-bold text-white">
                  Suggested Study Order
                </h4>

                {aiResult.plan.suggested_study_order.length > 0 ? (
                  <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-300">
                    {aiResult.plan.suggested_study_order.map((task, index) => (
                      <li key={index}>{task}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    No study order generated.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <p className="text-sm font-semibold text-blue-200">
                  {aiResult.plan.short_motivation}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MiniStat
                  label="Subjects"
                  value={aiResult.summary.total_subjects}
                />

                <MiniStat
                  label="Pending"
                  value={aiResult.summary.pending_assignments}
                />

                <MiniStat
                  label="Urgent"
                  value={aiResult.summary.urgent_assignments}
                />

                <MiniStat
                  label="Overdue"
                  value={aiResult.summary.overdue_assignments}
                />

                <MiniStat
                  label="Danger Attendance"
                  value={aiResult.summary.danger_attendance_subjects}
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
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300"
    >
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
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
        <h4 key={index} className="pt-3 text-lg font-bold text-white">
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
        <p key={index} className="pl-4 text-slate-300">
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
        <p key={index} className="pl-4 text-slate-300">
          {cleanLine}
        </p>
      );
    }

    return (
      <p key={index} className="text-slate-300">
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