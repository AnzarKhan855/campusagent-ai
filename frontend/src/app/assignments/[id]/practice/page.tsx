"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Difficulty = "all" | "easy" | "medium" | "hard";

type QuestionItem = {
  question: string;
  difficulty?: string;
  topic_tag?: string;
  is_important?: boolean;
};

type Assignment = {
  id: string;
  _id: string;
  title: string;
  subject?: string;
  subject_name?: string;
  questions?: QuestionItem[];
};

type PracticeTest = {
  id: string;
  _id: string;
  title: string;
  status: string;
  questions_count: number;
  answered_count: number;
  evaluated_count: number;
  total_score: number;
  max_score: number;
  percentage: number;
  created_at?: string;
  submitted_at?: string;
};

export default function CreatePracticeTestPage() {
  const params = useParams();
  const router = useRouter();

  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [tests, setTests] = useState<PracticeTest[]>([]);

  const [title, setTitle] = useState("ML Important Practice Test");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty>("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [importantOnly, setImportantOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const buttonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400";

  const questions = assignment?.questions || [];

  const topicOptions = Array.from(
    new Set(
      questions
        .map((question) => String(question.topic_tag || "").trim())
        .filter(Boolean)
    )
  ).sort();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  function formatDate(value?: string) {
    if (!value) return "Not submitted";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const assignmentResponse = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const assignmentData = await assignmentResponse.json();

      if (!assignmentResponse.ok) {
        throw new Error(assignmentData.detail || "Failed to fetch assignment");
      }

      setAssignment(assignmentData.assignment);

      const testsResponse = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/practice-tests`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const testsData = await testsResponse.json();

      if (testsResponse.ok) {
        setTests(testsData.tests || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function createPracticeTest() {
    try {
      setCreating(true);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      if (!title.trim()) {
        throw new Error("Please enter test title.");
      }

      if (questionCount < 1) {
        throw new Error("Question count must be at least 1.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/practice-tests/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title,
            question_count: questionCount,
            difficulty_filter: difficultyFilter,
            topic_filter: topicFilter,
            important_only: importantOnly,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create practice test");
      }

      setMessage("Practice test created successfully.");
      router.push(`/practice-tests/${data.test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <p className="text-slate-300">Loading practice test page...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/assignments/${assignmentId}/answer`)}
            className={buttonClass}
          >
            ← Back to Answer Workspace
          </button>

          <button
            onClick={() => router.push("/assignments")}
            className={buttonClass}
          >
            Back to Assignments
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 shadow-2xl">
          <p className="mb-2 text-sm font-medium text-emerald-400">
            Smart Exam Simulator
          </p>

          <h1 className="text-3xl font-bold text-white">
            Create AI Practice Test
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Assignment: {assignment?.title || "Assignment"} | Total Questions:{" "}
            {questions.length}
          </p>
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

        <section className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
          <h2 className="text-xl font-bold text-white">Test Settings</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Test Title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
                placeholder="ML Important Practice Test"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Number of Questions
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(Number(event.target.value))
                }
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Difficulty
              </label>
              <select
                value={difficultyFilter}
                onChange={(event) =>
                  setDifficultyFilter(event.target.value as Difficulty)
                }
                className={inputClass}
              >
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">
                Topic
              </label>
              <select
                value={topicFilter}
                onChange={(event) => setTopicFilter(event.target.value)}
                className={inputClass}
              >
                <option value="all">All Topics</option>
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={importantOnly}
              onChange={(event) => setImportantOnly(event.target.checked)}
              className="h-4 w-4"
            />
            Important questions only
          </label>

          <button
            onClick={createPracticeTest}
            disabled={creating}
            className={`${buttonClass} mt-6 px-6 py-3`}
          >
            {creating ? "Creating..." : "Start Practice Test"}
          </button>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
          <h2 className="text-xl font-bold text-white">Previous Practice Tests</h2>

          {tests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              No practice tests created yet.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#111827] p-4"
                >
                  <div>
                    <p className="font-bold text-white">{test.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Status: {test.status} | Questions: {test.questions_count} |
                      Score: {test.total_score}/{test.max_score} |{" "}
                      {test.percentage}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted: {formatDate(test.submitted_at)}
                    </p>
                  </div>

                  <button
                    onClick={() => router.push(`/practice-tests/${test.id}`)}
                    className={buttonClass}
                  >
                    Open Test
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}