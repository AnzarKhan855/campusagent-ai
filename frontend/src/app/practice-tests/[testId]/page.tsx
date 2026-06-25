"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PracticeQuestion = {
  question_index: number;
  source_question_index?: number;
  question: string;
  topic_tag?: string;
  difficulty?: string;
  is_important?: boolean;
  student_answer?: string;
  ai_score?: number | null;
  ai_feedback?: string;
  strengths?: string[];
  missing_points?: string[];
  model_answer?: string;
  evaluated_at?: string;
  answered_at?: string;
};

type PracticeTest = {
  id: string;
  _id: string;
  assignment_id: string;
  user_id?: string;
  title: string;
  status: "in_progress" | "submitted" | string;
  mode?: string;
  difficulty_filter?: string;
  topic_filter?: string;
  important_only?: boolean;
  questions: PracticeQuestion[];
  questions_count: number;
  answered_count: number;
  evaluated_count: number;
  total_score: number;
  max_score: number;
  percentage: number;
  weak_topics?: string[];
  created_at?: string;
  started_at?: string;
  updated_at?: string;
  submitted_at?: string;
};

export default function PracticeTestAttemptPage() {
  const params = useParams();
  const router = useRouter();

  const testId = params.testId as string;

  const [test, setTest] = useState<PracticeTest | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const buttonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const primaryButtonClass =
    "rounded-xl border border-emerald-500/40 bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const questions = test?.questions || [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const isSubmitted = test?.status === "submitted";

  useEffect(() => {
    fetchPracticeTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function getDifficultyBadgeClass(value?: string) {
    const difficulty = String(value || "medium").toLowerCase();

    if (difficulty === "easy") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (difficulty === "hard") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  function renderList(items?: string[]) {
    if (!items || items.length === 0) {
      return <p className="mt-2 text-sm text-slate-400">No points saved.</p>;
    }

    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  function syncAnswersFromTest(fetchedTest: PracticeTest) {
    const initialAnswers: Record<number, string> = {};

    fetchedTest.questions?.forEach((question, index) => {
      initialAnswers[index] = question.student_answer || "";
    });

    setAnswers(initialAnswers);
  }

  async function fetchPracticeTest() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/practice-tests/${testId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch practice test");
      }

      setTest(data.test);
      syncAnswersFromTest(data.test);

      if (!data.test.questions || data.test.questions.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= data.test.questions.length) {
        setCurrentIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswer(questionIndex: number) {
    try {
      setSavingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      if (isSubmitted) {
        throw new Error("This test is already submitted. Answers cannot be edited.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/practice-tests/${testId}/save-answer`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question_index: questionIndex,
            student_answer: answers[questionIndex] || "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to save answer");
      }

      setTest(data.test);
      syncAnswersFromTest(data.test);
      setMessage(`Answer ${questionIndex + 1} saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingIndex(null);
    }
  }

  async function submitTest() {
    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const confirmSubmit = window.confirm(
        "Are you sure you want to submit this practice test? After submission, answers cannot be edited."
      );

      if (!confirmSubmit) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/practice-tests/${testId}/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to submit practice test");
      }

      setTest(data.test);
      syncAnswersFromTest(data.test);
      setMessage("Practice test submitted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function goPrevious() {
    setCurrentIndex((previous) => Math.max(previous - 1, 0));
    setMessage("");
    setError("");
  }

  function goNext() {
    setCurrentIndex((previous) =>
      Math.min(previous + 1, totalQuestions - 1)
    );
    setMessage("");
    setError("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <p className="text-slate-300">Loading practice test...</p>
      </main>
    );
  }

  if (!test) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          Practice test not found.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() =>
              router.push(`/assignments/${test.assignment_id}/practice`)
            }
            className={buttonClass}
          >
            ← Back to Practice Tests
          </button>

          <button
            onClick={() =>
              router.push(`/assignments/${test.assignment_id}/answer`)
            }
            className={buttonClass}
          >
            Back to Answer Workspace
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-emerald-400">
                Smart Exam Simulator
              </p>

              <h1 className="text-3xl font-bold text-white">{test.title}</h1>

              <p className="mt-2 text-sm text-slate-400">
                Status:{" "}
                <span className="font-semibold text-slate-200">
                  {test.status}
                </span>{" "}
                | Questions: {test.questions_count}
              </p>
            </div>

            {isSubmitted ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-emerald-300">
                Submitted
              </div>
            ) : (
              <button
                onClick={submitTest}
                disabled={submitting}
                className={primaryButtonClass}
              >
                {submitting ? "Submitting..." : "Submit Test"}
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Answered</p>
              <p className="mt-1 text-xl font-bold text-slate-100">
                {test.answered_count}/{test.questions_count}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Evaluated</p>
              <p className="mt-1 text-xl font-bold text-cyan-300">
                {test.evaluated_count}/{test.questions_count}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Score</p>
              <p className="mt-1 text-xl font-bold text-emerald-300">
                {test.total_score}/{test.max_score}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Percentage</p>
              <p className="mt-1 text-xl font-bold text-purple-300">
                {test.percentage}%
              </p>
            </div>
          </div>

          {isSubmitted && (
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${test.percentage}%` }}
              />
            </div>
          )}

          {isSubmitted && test.weak_topics && test.weak_topics.length > 0 && (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-300">Weak Topics</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {test.weak_topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Started: {formatDate(test.started_at)} | Submitted:{" "}
            {formatDate(test.submitted_at)}
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

        {totalQuestions === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
            <h2 className="text-xl font-bold text-white">No questions found</h2>
            <p className="mt-2 text-sm text-slate-400">
              This practice test has no questions.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-400">
                    Question {currentIndex + 1} of {totalQuestions}
                  </p>

                  <h2 className="mt-2 text-lg font-bold leading-7 text-white">
                    {currentQuestion?.question}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDifficultyBadgeClass(
                      currentQuestion?.difficulty
                    )}`}
                  >
                    {String(currentQuestion?.difficulty || "medium").toUpperCase()}
                  </span>

                  {currentQuestion?.topic_tag && (
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                      {currentQuestion.topic_tag}
                    </span>
                  )}

                  {currentQuestion?.is_important && (
                    <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                      Important ⭐
                    </span>
                  )}

                  {isSubmitted && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Score: {currentQuestion?.ai_score ?? 0}/10
                    </span>
                  )}
                </div>
              </div>

              <textarea
                value={answers[currentIndex] || ""}
                onChange={(event) =>
                  setAnswers((previous) => ({
                    ...previous,
                    [currentIndex]: event.target.value,
                  }))
                }
                readOnly={isSubmitted}
                placeholder="Write your answer here..."
                className="min-h-48 w-full rounded-2xl border border-slate-700 bg-[#111827] p-4 text-sm leading-7 text-slate-100 outline-none transition-all duration-200 focus:border-emerald-400 focus:shadow-lg focus:shadow-emerald-500/10 disabled:opacity-60"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => saveAnswer(currentIndex)}
                  disabled={isSubmitted || savingIndex === currentIndex}
                  className={buttonClass}
                >
                  {savingIndex === currentIndex ? "Saving..." : "Save Answer"}
                </button>

                <button
                  onClick={goPrevious}
                  disabled={currentIndex <= 0}
                  className={buttonClass}
                >
                  ← Previous
                </button>

                <button
                  onClick={goNext}
                  disabled={currentIndex >= totalQuestions - 1}
                  className={buttonClass}
                >
                  Next →
                </button>

                <select
                  value={currentIndex}
                  onChange={(event) => setCurrentIndex(Number(event.target.value))}
                  className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 outline-none transition focus:border-emerald-400"
                >
                  {questions.map((question, index) => (
                    <option key={question.question_index} value={index}>
                      Go to Question {index + 1}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {isSubmitted && currentQuestion && (
              <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
                <h2 className="text-xl font-bold text-white">
                  AI Evaluation Report
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
                    <p className="text-xs text-slate-400">AI Score</p>
                    <p className="mt-1 text-3xl font-bold text-emerald-300">
                      {currentQuestion.ai_score ?? 0}/10
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
                    <p className="text-xs text-slate-400">Evaluated At</p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {formatDate(currentQuestion.evaluated_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-200">
                    AI Feedback
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {currentQuestion.ai_feedback || "No feedback saved."}
                  </p>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-200">
                    Strengths
                  </p>
                  {renderList(currentQuestion.strengths)}
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-200">
                    Missing Points
                  </p>
                  {renderList(currentQuestion.missing_points)}
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-200">
                    Model Answer
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-800 bg-[#111827] p-4 text-sm leading-7 text-slate-300">
                    {currentQuestion.model_answer || "No model answer saved."}
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}