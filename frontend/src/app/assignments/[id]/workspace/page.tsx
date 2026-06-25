"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Assignment = {
  _id?: string;
  id?: string;
  title: string;
  subject?: string;
  subject_name?: string;
  details?: string;
  description?: string;
  due_date?: string;
  priority?: string;
  status?: string;
  pdf_filename?: string;
  has_pdf?: boolean;
  pdf_text_length?: number;
  questions_count?: number;
  answered_count?: number;
};

export default function AssignmentWorkspacePage() {
  const params = useParams();
  const router = useRouter();

  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const buttonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const smallButtonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const actionButtonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-5 py-3 font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  useEffect(() => {
    fetchAssignment();
  }, [assignmentId]);

  async function fetchAssignment() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("campusagent_token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch assignment");
      }

      setAssignment(data.assignment || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function askAI(command: string) {
    try {
      setAiLoading(true);
      setAiAnswer("");
      setError("");
      setMessage("");

      const token = localStorage.getItem("campusagent_token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          command,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI request failed");
      }

      setAiAnswer(data.answer || "No answer received from AI.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  }

  async function extractQuestions() {
    try {
      setExtracting(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("campusagent_token");

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/extract-questions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to extract questions");
      }

      setMessage(`Extracted ${data.count} questions successfully.`);
      setAssignment(data.assignment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <p className="text-slate-300">Loading assignment workspace...</p>
      </main>
    );
  }

  if (error && !assignment) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <button
          onClick={() => router.push("/assignments")}
          className={`${smallButtonClass} mb-6`}
        >
          ← Back to Assignments
        </button>

        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <button
          onClick={() => router.push("/assignments")}
          className={`${smallButtonClass} mb-6`}
        >
          ← Back to Assignments
        </button>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 shadow-2xl">
          <p className="mb-2 text-sm font-medium text-emerald-400">
            AI Assignment Workspace
          </p>

          <h1 className="text-3xl font-bold text-white">
            {assignment?.title || "Untitled Assignment"}
          </h1>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Subject</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.subject || assignment?.subject_name || "Unknown"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Due Date</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.due_date || "No due date"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Priority</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.priority || "Medium"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Status</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.status || "Pending"}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-800 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">Assignment Details</p>
            <p className="mt-2 text-slate-200">
              {assignment?.details ||
                assignment?.description ||
                "No assignment details added yet."}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-300">Uploaded PDF</p>
              <p className="mt-1 font-semibold text-emerald-100">
                {assignment?.pdf_filename || "No PDF uploaded yet"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">PDF Text Length</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.pdf_text_length || 0} characters
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Extracted Questions</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.questions_count || 0}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
            <h2 className="text-xl font-bold text-white">AI PDF Helper</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use this when you do not understand the uploaded assignment PDF.
              The AI will read the uploaded PDF text, not only assignment
              details.
            </p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={() =>
                  askAI(
                    "Use only the uploaded PDF text. Ignore assignment details. Explain the uploaded PDF as it is in simple language."
                  )
                }
                className={buttonClass}
              >
                Explain this PDF
              </button>

              <button
                onClick={() =>
                  askAI(
                    "Use only the uploaded PDF text. Ignore assignment details. Extract and list the important questions from the uploaded PDF."
                  )
                }
                className={buttonClass}
              >
                List Important Questions
              </button>

              <button
                onClick={() =>
                  askAI(
                    "Use only the uploaded PDF text. Ignore assignment details. Make a preparation plan based on the uploaded PDF questions."
                  )
                }
                className={buttonClass}
              >
                Make Preparation Plan
              </button>

              <button
                onClick={() =>
                  askAI(
                    "Use only the uploaded PDF text. Ignore assignment details. Summarize the uploaded PDF as it is."
                  )
                }
                className={buttonClass}
              >
                Summarize PDF
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
            <h2 className="text-xl font-bold text-white">AI Response</h2>

            {aiLoading ? (
              <p className="mt-4 text-slate-300">AI is thinking...</p>
            ) : aiAnswer ? (
              <div className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-[#111827] p-4 text-sm leading-7 text-slate-200">
                {aiAnswer}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                Click any AI helper button to get explanation, questions,
                summary, or preparation plan.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
          <h2 className="text-xl font-bold text-white">
            Student Answer Workspace
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Open the separate answer page to write question-wise answers, save
            your work, evaluate answers, and generate a downloadable PDF
            anytime. Missing answers will show as “Not answered yet.”
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Questions</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.questions_count || 0} extracted
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Answers</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.answered_count || 0} completed
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">PDF Export</p>
              <p className="mt-1 font-semibold text-emerald-300">
                Available anytime
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={extractQuestions}
              disabled={extracting}
              className={actionButtonClass}
            >
              {extracting ? "Extracting..." : "Extract Questions"}
            </button>

            <button
              onClick={() => router.push(`/assignments/${assignmentId}/answer`)}
              className={actionButtonClass}
            >
              Open Answer Page
            </button>

            <button onClick={fetchAssignment} className={actionButtonClass}>
              Refresh Assignment
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}