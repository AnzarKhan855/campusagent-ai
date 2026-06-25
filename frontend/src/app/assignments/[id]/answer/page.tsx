"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Difficulty = "easy" | "medium" | "hard";

type QuestionItem = {
  question_number?: number;
  question: string;
  student_answer: string;

  is_important?: boolean;
  difficulty?: Difficulty | string;
  topic_tag?: string;
  auto_tagged_at?: string;

  ai_explanation?: string;
  ai_generated_answer?: string;
  ai_answer_generated_at?: string;

  ai_score?: number | null;
  ai_feedback?: string;
  strengths?: string[];
  missing_points?: string[];
  improved_answer?: string;
  evaluated_at?: string;

  score?: number | null;
  answered_at?: string;
};

type Assignment = {
  _id: string;
  id: string;
  title: string;
  subject?: string;
  subject_name?: string;
  description?: string;
  details?: string;
  due_date?: string;
  priority?: string;
  status?: string;
  pdf_filename?: string;
  has_pdf?: boolean;

  questions?: QuestionItem[];
  questions_count?: number;
  answered_count?: number;
  evaluated_count?: number;
  important_count?: number;
  ai_answer_count?: number;
  auto_tagged_count?: number;
  topic_counts?: Record<string, number>;
  difficulty_counts?: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
  completion_percentage?: number;
  all_questions_answered?: boolean;
};

type QuestionFilter =
  | "all"
  | "answered"
  | "missing"
  | "evaluated"
  | "not_evaluated"
  | "important"
  | "ai_answer"
  | "auto_tagged"
  | "easy"
  | "medium"
  | "hard";

export default function AssignmentAnswerPage() {
  const params = useParams();
  const router = useRouter();

  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [aiHelp, setAiHelp] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [evaluatingIndex, setEvaluatingIndex] = useState<number | null>(null);
  const [importantLoadingIndex, setImportantLoadingIndex] = useState<
    number | null
  >(null);
  const [difficultyLoadingIndex, setDifficultyLoadingIndex] = useState<
    number | null
  >(null);
  const [aiAnswerLoadingIndex, setAiAnswerLoadingIndex] = useState<
    number | null
  >(null);
  const [aiHelpLoadingIndex, setAiHelpLoadingIndex] = useState<number | null>(
    null
  );
  const [autoTagLoading, setAutoTagLoading] = useState(false);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");
  const [topicFilter, setTopicFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const outlineButtonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const primaryButtonClass =
    "rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60";

  const questions = assignment?.questions || [];
  const totalQuestions = questions.length;

  const topicCounts =
    assignment?.topic_counts ??
    questions.reduce<Record<string, number>>((accumulator, question) => {
      const topic = normalizeTopic(question.topic_tag);

      if (topic) {
        accumulator[topic] = (accumulator[topic] || 0) + 1;
      }

      return accumulator;
    }, {});

  const topicOptions = Object.keys(topicCounts).sort((first, second) =>
    first.localeCompare(second)
  );

  const filteredQuestions = questions
    .map((question, index) => ({
      question,
      originalIndex: index,
    }))
    .filter(({ question, originalIndex }) => {
      const searchValue = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        question.question.toLowerCase().includes(searchValue) ||
        String(question.question_number || originalIndex + 1).includes(
          searchValue
        ) ||
        String(question.topic_tag || "").toLowerCase().includes(searchValue);

      const answerText =
        answers[originalIndex] || question.student_answer || "";

      const isAnswered = Boolean(answerText.trim());
      const isEvaluated = hasSavedEvaluation(question);
      const isImportant = Boolean(question.is_important);
      const isAiAnswerGenerated = hasAIAnswer(question);
      const isAutoTagged = hasAutoTag(question);
      const difficulty = normalizeDifficulty(question.difficulty);
      const topic = normalizeTopic(question.topic_tag);

      let matchesFilter = true;

      if (questionFilter === "answered") {
        matchesFilter = isAnswered;
      }

      if (questionFilter === "missing") {
        matchesFilter = !isAnswered;
      }

      if (questionFilter === "evaluated") {
        matchesFilter = isEvaluated;
      }

      if (questionFilter === "not_evaluated") {
        matchesFilter = !isEvaluated;
      }

      if (questionFilter === "important") {
        matchesFilter = isImportant;
      }

      if (questionFilter === "ai_answer") {
        matchesFilter = isAiAnswerGenerated;
      }

      if (questionFilter === "auto_tagged") {
        matchesFilter = isAutoTagged;
      }

      if (questionFilter === "easy") {
        matchesFilter = difficulty === "easy";
      }

      if (questionFilter === "medium") {
        matchesFilter = difficulty === "medium";
      }

      if (questionFilter === "hard") {
        matchesFilter = difficulty === "hard";
      }

      const matchesTopic =
        topicFilter === "all" ||
        topic.toLowerCase() === topicFilter.toLowerCase();

      return matchesSearch && matchesFilter && matchesTopic;
    });

  const currentFilteredPosition = filteredQuestions.findIndex(
    (item) => item.originalIndex === currentQuestionIndex
  );

  const activeQuestionIndex =
    filteredQuestions.length > 0
      ? currentFilteredPosition === -1
        ? filteredQuestions[0].originalIndex
        : currentQuestionIndex
      : currentQuestionIndex;

  const currentQuestion = questions[activeQuestionIndex];

  const answeredCount =
    assignment?.answered_count ??
    questions.filter((question, index) =>
      (answers[index] || question.student_answer || "").trim()
    ).length;

  const evaluatedCount =
    assignment?.evaluated_count ??
    questions.filter((question) => hasSavedEvaluation(question)).length;

  const importantCount =
    assignment?.important_count ??
    questions.filter((question) => Boolean(question.is_important)).length;

  const aiAnswerCount =
    assignment?.ai_answer_count ??
    questions.filter((question) => hasAIAnswer(question)).length;

  const autoTaggedCount =
    assignment?.auto_tagged_count ??
    questions.filter((question) => hasAutoTag(question)).length;

  const difficultyCounts = assignment?.difficulty_counts ?? {
    easy: questions.filter(
      (question) => normalizeDifficulty(question.difficulty) === "easy"
    ).length,
    medium: questions.filter(
      (question) => normalizeDifficulty(question.difficulty) === "medium"
    ).length,
    hard: questions.filter(
      (question) => normalizeDifficulty(question.difficulty) === "hard"
    ).length,
  };

  const completionPercentage =
    assignment?.completion_percentage ??
    (totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0);

  useEffect(() => {
    fetchAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  function normalizeDifficulty(value?: string): Difficulty {
    const difficulty = String(value || "medium").toLowerCase();

    if (
      difficulty === "easy" ||
      difficulty === "medium" ||
      difficulty === "hard"
    ) {
      return difficulty;
    }

    return "medium";
  }

  function normalizeTopic(value?: string) {
    return String(value || "").trim();
  }

  function getDifficultyBadgeClass(difficulty?: string) {
    const normalized = normalizeDifficulty(difficulty);

    if (normalized === "easy") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (normalized === "hard") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  function hasAIAnswer(question?: QuestionItem) {
    if (!question) return false;
    return Boolean(question.ai_generated_answer?.trim());
  }

  function hasAutoTag(question?: QuestionItem) {
    if (!question) return false;

    return (
      Boolean(question.auto_tagged_at?.trim()) ||
      Boolean(question.topic_tag?.trim())
    );
  }

  function hasSavedEvaluation(question?: QuestionItem) {
    if (!question) return false;

    const hasScore =
      question.ai_score !== undefined && question.ai_score !== null;

    const hasOldScore =
      question.score !== undefined && question.score !== null;

    const hasFeedback = Boolean(question.ai_feedback?.trim());
    const hasImprovedAnswer = Boolean(question.improved_answer?.trim());
    const hasEvaluatedAt = Boolean(question.evaluated_at?.trim());

    return (
      hasScore ||
      hasOldScore ||
      hasFeedback ||
      hasImprovedAnswer ||
      hasEvaluatedAt
    );
  }

  function formatDate(value?: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
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

  async function fetchAssignment() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = getToken();

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

      const fetchedAssignment: Assignment = data.assignment;
      setAssignment(fetchedAssignment);

      const initialAnswers: Record<number, string> = {};

      fetchedAssignment.questions?.forEach((question, index) => {
        initialAnswers[index] = question.student_answer || "";
      });

      setAnswers(initialAnswers);

      if (
        !fetchedAssignment.questions ||
        fetchedAssignment.questions.length === 0
      ) {
        setCurrentQuestionIndex(0);
      } else if (currentQuestionIndex >= fetchedAssignment.questions.length) {
        setCurrentQuestionIndex(0);
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

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/save-answer`,
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

      setAssignment(data.assignment);
      setMessage(`Answer ${questionIndex + 1} saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingIndex(null);
    }
  }

  async function toggleImportant(questionIndex: number) {
    try {
      setImportantLoadingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const question = questions[questionIndex];

      if (!question) {
        throw new Error("Question not found.");
      }

      const newImportantStatus = !question.is_important;

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/mark-important`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question_index: questionIndex,
            is_important: newImportantStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update important status");
      }

      setAssignment(data.assignment);

      setMessage(
        newImportantStatus
          ? `Question ${questionIndex + 1} marked important.`
          : `Question ${questionIndex + 1} removed from important.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImportantLoadingIndex(null);
    }
  }

  async function updateDifficulty(questionIndex: number, difficulty: Difficulty) {
    try {
      setDifficultyLoadingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const question = questions[questionIndex];

      if (!question) {
        throw new Error("Question not found.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/update-difficulty`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question_index: questionIndex,
            difficulty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update difficulty");
      }

      setAssignment(data.assignment);
      setMessage(
        `Question ${questionIndex + 1} difficulty updated to ${difficulty}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDifficultyLoadingIndex(null);
    }
  }

  async function autoTagQuestions() {
    try {
      setAutoTagLoading(true);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      if (totalQuestions === 0) {
        throw new Error("No questions found. Please extract questions first.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/auto-tag`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            limit: 12,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to auto tag questions");
      }

      setAssignment(data.assignment);
      setQuestionFilter("all");
      setTopicFilter("all");

      setMessage(
        `AI auto tagged ${data.tagged_count || totalQuestions} questions successfully.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAutoTagLoading(false);
    }
  }

  async function generateAIAnswer(questionIndex: number) {
    try {
      setAiAnswerLoadingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const question = questions[questionIndex];

      if (!question) {
        throw new Error("Question not found.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/generate-ai-answer`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question_index: questionIndex,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate AI answer");
      }

      setAssignment(data.assignment);
      setMessage(`AI answer generated for Question ${questionIndex + 1}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiAnswerLoadingIndex(null);
    }
  }

  async function explainQuestion(questionIndex: number) {
    try {
      setAiHelpLoadingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const question = questions[questionIndex];

      if (!question) {
        throw new Error("Question not found.");
      }

      const command = `Explain this question in simple language and give key points:

Question:
${question.question}`;

      const response = await fetch(`${API_BASE_URL}/api/ai/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI request failed");
      }

      setAiHelp((previous) => ({
        ...previous,
        [questionIndex]: data.answer || "No AI response received.",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiHelpLoadingIndex(null);
    }
  }

  async function evaluateAnswer(questionIndex: number) {
    try {
      setEvaluatingIndex(questionIndex);
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const studentAnswer = answers[questionIndex] || "";

      if (!studentAnswer.trim()) {
        throw new Error("Please write your answer first, then evaluate it.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/questions/evaluate-answer`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question_index: questionIndex,
            student_answer: studentAnswer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to evaluate answer");
      }

      setAssignment(data.assignment);

      setAnswers((previous) => ({
        ...previous,
        [questionIndex]:
          data.assignment?.questions?.[questionIndex]?.student_answer ||
          studentAnswer,
      }));

      setMessage(`Answer ${questionIndex + 1} evaluated and saved permanently.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setEvaluatingIndex(null);
    }
  }

  async function generatePdf() {
    try {
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/generate-pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate PDF";

        try {
          const data = await response.json();
          errorMessage =
            data.detail?.message ||
            data.detail ||
            data.message ||
            "Failed to generate PDF";
        } catch {
          errorMessage = `Failed to generate PDF. Status: ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Downloaded PDF is empty.");
      }

      const fileUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = `${assignment?.title || "assignment"}_answers.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(fileUrl);

      setMessage("PDF downloaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    }
  }

  async function printPdf() {
    try {
      setError("");
      setMessage("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/assignments/${assignmentId}/generate-pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate PDF";

        try {
          const data = await response.json();
          errorMessage =
            data.detail?.message ||
            data.detail ||
            data.message ||
            "Failed to generate PDF";
        } catch {
          errorMessage = `Failed to generate PDF. Status: ${response.status}`;
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Generated PDF is empty.");
      }

      const fileUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(fileUrl);

      if (!printWindow) {
        throw new Error("Popup blocked. Please allow popups to print the PDF.");
      }

      printWindow.onload = () => {
        printWindow.print();
      };

      setMessage("PDF opened for printing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function extractQuestions() {
    try {
      setError("");
      setMessage("");

      const token = getToken();

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
      setCurrentQuestionIndex(0);

      const initialAnswers: Record<number, string> = {};

      data.assignment.questions?.forEach(
        (question: QuestionItem, index: number) => {
          initialAnswers[index] = question.student_answer || "";
        }
      );

      setAnswers(initialAnswers);
      setAiHelp({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function goToPreviousQuestion() {
    if (filteredQuestions.length === 0) return;

    const currentPosition =
      currentFilteredPosition === -1 ? 0 : currentFilteredPosition;

    const previousPosition = Math.max(currentPosition - 1, 0);

    setCurrentQuestionIndex(filteredQuestions[previousPosition].originalIndex);
    setMessage("");
    setError("");
  }

  function goToNextQuestion() {
    if (filteredQuestions.length === 0) return;

    const currentPosition =
      currentFilteredPosition === -1 ? 0 : currentFilteredPosition;

    const nextPosition = Math.min(
      currentPosition + 1,
      filteredQuestions.length - 1
    );

    setCurrentQuestionIndex(filteredQuestions[nextPosition].originalIndex);
    setMessage("");
    setError("");
  }

  function goToQuestion(index: number) {
    setCurrentQuestionIndex(index);
    setMessage("");
    setError("");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070A12] p-6 text-white">
        <p className="text-slate-300">Loading answer workspace...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => router.push("/assignments")}
            className={outlineButtonClass}
          >
            ← Back to Assignments
          </button>

          <button
            onClick={() => router.push(`/assignments/${assignmentId}/workspace`)}
            className={outlineButtonClass}
          >
            Open PDF Workspace
          </button>

          <button
            onClick={() => router.push(`/assignments/${assignmentId}/practice`)}
            className={outlineButtonClass}
          >
            Practice Test Mode
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-emerald-400">
                Student Answer Workspace
              </p>

              <h1 className="text-3xl font-bold text-white">
                {assignment?.title || "Assignment"}
              </h1>
            </div>

            {totalQuestions > 0 && (
              <button
                onClick={autoTagQuestions}
                disabled={autoTagLoading}
                className={`${primaryButtonClass} px-5 py-3`}
              >
                {autoTagLoading ? "AI Tagging..." : "Auto Tag Questions"}
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Subject</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.subject || assignment?.subject_name || "Unknown"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">PDF</p>
              <p className="mt-1 font-semibold text-slate-100">
                {assignment?.pdf_filename || "No PDF uploaded"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Answered</p>
              <p className="mt-1 font-semibold text-slate-100">
                {answeredCount}/{totalQuestions}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Evaluated</p>
              <p className="mt-1 font-semibold text-emerald-300">
                {evaluatedCount}/{totalQuestions}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Important</p>
              <p className="mt-1 font-semibold text-yellow-300">
                {importantCount}/{totalQuestions}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">AI Answers</p>
              <p className="mt-1 font-semibold text-purple-300">
                {aiAnswerCount}/{totalQuestions}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Auto Tagged</p>
              <p className="mt-1 font-semibold text-cyan-300">
                {autoTaggedCount}/{totalQuestions}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
              <p className="text-xs text-slate-400">Difficulty</p>
              <p className="mt-1 text-xs font-semibold text-slate-200">
                E: {difficultyCounts.easy || 0} | M:{" "}
                {difficultyCounts.medium || 0} | H:{" "}
                {difficultyCounts.hard || 0}
              </p>
            </div>
          </div>

          {topicOptions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <p className="text-sm font-semibold text-cyan-300">Topic Tags</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {topicOptions.slice(0, 18).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                  >
                    {topic} ({topicCounts[topic]})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${completionPercentage}%`,
              }}
            />
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Completion: {completionPercentage}%. You can generate the PDF
            anytime. Questions without answers will be marked as “Not answered
            yet.”
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

        {totalQuestions > 0 && (
          <section className="mb-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Search Questions
                </label>

                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setMessage("");
                    setError("");
                  }}
                  placeholder="Search question, number, or topic..."
                  className="w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Filter Questions
                </label>

                <select
                  value={questionFilter}
                  onChange={(event) => {
                    setQuestionFilter(event.target.value as QuestionFilter);
                    setMessage("");
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
                >
                  <option value="all">All Questions</option>
                  <option value="answered">Answered</option>
                  <option value="missing">Missing Answers</option>
                  <option value="evaluated">Evaluated</option>
                  <option value="not_evaluated">Not Evaluated</option>
                  <option value="important">Important ⭐</option>
                  <option value="ai_answer">AI Answer Generated</option>
                  <option value="auto_tagged">Auto Tagged</option>
                  <option value="easy">Easy Questions</option>
                  <option value="medium">Medium Questions</option>
                  <option value="hard">Hard Questions</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Filter by Topic
                </label>

                <select
                  value={topicFilter}
                  onChange={(event) => {
                    setTopicFilter(event.target.value);
                    setMessage("");
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400"
                >
                  <option value="all">All Topics</option>
                  {topicOptions.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic} ({topicCounts[topic]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-400">
              Showing {filteredQuestions.length} of {totalQuestions} questions.
            </p>
          </section>
        )}

        {totalQuestions === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
            <h2 className="text-xl font-bold text-white">
              No extracted questions yet
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Your PDF is uploaded, but questions are not extracted yet. Click
              the button below to extract questions from the uploaded PDF.
            </p>

            <button
              onClick={extractQuestions}
              className={`${primaryButtonClass} mt-5 px-5 py-3`}
            >
              Extract Questions from PDF
            </button>
          </section>
        ) : (
          <>
            <section className="space-y-5">
              {filteredQuestions.length === 0 ? (
                <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-200">
                  No questions found for this search/filter.
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-400">
                          Question {activeQuestionIndex + 1} of {totalQuestions}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Filter position:{" "}
                          {currentFilteredPosition === -1
                            ? 1
                            : currentFilteredPosition + 1}{" "}
                          of {filteredQuestions.length}
                        </p>

                        <h2 className="mt-2 text-lg font-bold leading-7 text-white">
                          {currentQuestion?.question || "Question not found"}
                        </h2>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getDifficultyBadgeClass(
                            currentQuestion?.difficulty
                          )}`}
                        >
                          Difficulty:{" "}
                          {normalizeDifficulty(
                            currentQuestion?.difficulty
                          ).toUpperCase()}
                        </span>

                        {currentQuestion?.topic_tag && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                            Topic: {currentQuestion.topic_tag}
                          </span>
                        )}

                        {hasAutoTag(currentQuestion) && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                            Auto Tagged
                          </span>
                        )}

                        {currentQuestion?.is_important && (
                          <span className="rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                            Important ⭐
                          </span>
                        )}

                        {hasAIAnswer(currentQuestion) && (
                          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                            AI Answer Ready
                          </span>
                        )}

                        {(answers[activeQuestionIndex] || "").trim() ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Answered
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                            Missing Answer
                          </span>
                        )}

                        {hasSavedEvaluation(currentQuestion) ? (
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                            Evaluated
                          </span>
                        ) : (
                          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                            Not Evaluated
                          </span>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={answers[activeQuestionIndex] || ""}
                      onChange={(event) =>
                        setAnswers((previous) => ({
                          ...previous,
                          [activeQuestionIndex]: event.target.value,
                        }))
                      }
                      placeholder="Write your answer here..."
                      className="min-h-44 w-full rounded-2xl border border-slate-700 bg-[#111827] p-4 text-sm leading-7 text-slate-100 outline-none transition-all duration-200 focus:border-emerald-400 focus:shadow-lg focus:shadow-emerald-500/10"
                    />

                    <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => saveAnswer(activeQuestionIndex)}
                          disabled={savingIndex === activeQuestionIndex}
                          className={primaryButtonClass}
                        >
                          {savingIndex === activeQuestionIndex
                            ? "Saving..."
                            : "Save Answer"}
                        </button>

                        <button
                          onClick={() => explainQuestion(activeQuestionIndex)}
                          disabled={aiHelpLoadingIndex === activeQuestionIndex}
                          className={outlineButtonClass}
                        >
                          {aiHelpLoadingIndex === activeQuestionIndex
                            ? "AI Thinking..."
                            : "Explain Question"}
                        </button>

                        <button
                          onClick={() => generateAIAnswer(activeQuestionIndex)}
                          disabled={aiAnswerLoadingIndex === activeQuestionIndex}
                          className={outlineButtonClass}
                        >
                          {aiAnswerLoadingIndex === activeQuestionIndex
                            ? "Generating..."
                            : hasAIAnswer(currentQuestion)
                            ? "Regenerate AI Answer"
                            : "Generate AI Answer"}
                        </button>

                        <button
                          onClick={() => evaluateAnswer(activeQuestionIndex)}
                          disabled={evaluatingIndex === activeQuestionIndex}
                          className={outlineButtonClass}
                        >
                          {evaluatingIndex === activeQuestionIndex
                            ? "Evaluating..."
                            : "Evaluate Answer"}
                        </button>

                        <button
                          onClick={() => toggleImportant(activeQuestionIndex)}
                          disabled={
                            importantLoadingIndex === activeQuestionIndex
                          }
                          className={outlineButtonClass}
                        >
                          {importantLoadingIndex === activeQuestionIndex
                            ? "Updating..."
                            : currentQuestion?.is_important
                            ? "Remove Important ⭐"
                            : "Mark Important ⭐"}
                        </button>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold text-slate-400">
                          Difficulty
                        </label>

                        <select
                          value={normalizeDifficulty(currentQuestion?.difficulty)}
                          onChange={(event) =>
                            updateDifficulty(
                              activeQuestionIndex,
                              event.target.value as Difficulty
                            )
                          }
                          disabled={
                            difficultyLoadingIndex === activeQuestionIndex
                          }
                          className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    {currentQuestion?.auto_tagged_at && (
                      <p className="mt-4 text-xs text-slate-500">
                        Auto Tagged At:{" "}
                        {formatDate(currentQuestion.auto_tagged_at)}
                      </p>
                    )}

                    {aiHelp[activeQuestionIndex] && (
                      <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-7 text-emerald-100">
                        {aiHelp[activeQuestionIndex]}
                      </div>
                    )}

                    <div className="mt-5 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-white">
                          AI Generated Answer
                        </h3>

                        {hasAIAnswer(currentQuestion) ? (
                          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                            Saved in MongoDB
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                            Not generated yet
                          </span>
                        )}
                      </div>

                      {hasAIAnswer(currentQuestion) ? (
                        <div className="mt-4">
                          <p className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#0D1324] p-4 text-sm leading-7 text-slate-200">
                            {currentQuestion?.ai_generated_answer}
                          </p>

                          <p className="mt-3 text-xs text-slate-500">
                            Generated At:{" "}
                            {formatDate(
                              currentQuestion?.ai_answer_generated_at
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">
                          Click Generate AI Answer to create an exam-ready model
                          answer for this question.
                        </p>
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-[#111827] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-white">
                          Saved AI Evaluation
                        </h3>

                        {hasSavedEvaluation(currentQuestion) ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Saved in MongoDB
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400">
                            Not evaluated yet
                          </span>
                        )}
                      </div>

                      {hasSavedEvaluation(currentQuestion) ? (
                        <div className="mt-4 space-y-5">
                          <div className="rounded-xl border border-slate-800 bg-[#0D1324] p-4">
                            <p className="text-xs text-slate-400">AI Score</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-300">
                              {currentQuestion?.ai_score ??
                                currentQuestion?.score ??
                                "N/A"}
                              /10
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              Overall Feedback
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                              {currentQuestion?.ai_feedback ||
                                "No feedback saved."}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              Strengths
                            </p>
                            {renderList(currentQuestion?.strengths)}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              Missing Points
                            </p>
                            {renderList(currentQuestion?.missing_points)}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              Improved Answer
                            </p>
                            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#0D1324] p-4 text-sm leading-7 text-slate-300">
                              {currentQuestion?.improved_answer ||
                                "No improved answer saved."}
                            </p>
                          </div>

                          <p className="text-xs text-slate-500">
                            Evaluated At:{" "}
                            {formatDate(currentQuestion?.evaluated_at)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-400">
                          Click Evaluate Answer to save AI score, feedback,
                          strengths, missing points, and improved answer
                          permanently in MongoDB.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-[#0D1324] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={goToPreviousQuestion}
                        disabled={
                          filteredQuestions.length === 0 ||
                          currentFilteredPosition <= 0
                        }
                        className={outlineButtonClass}
                      >
                        ← Previous
                      </button>

                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-slate-300">
                          Question {activeQuestionIndex + 1} / {totalQuestions}
                        </p>

                        <select
                          value={activeQuestionIndex}
                          onChange={(event) =>
                            goToQuestion(Number(event.target.value))
                          }
                          className="rounded-xl border border-slate-700 bg-[#111827] px-3 py-2 text-sm font-semibold text-slate-200 outline-none transition focus:border-emerald-400"
                        >
                          {filteredQuestions.map(({ originalIndex }) => (
                            <option key={originalIndex} value={originalIndex}>
                              Go to Question {originalIndex + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={goToNextQuestion}
                        disabled={
                          filteredQuestions.length === 0 ||
                          filteredQuestions.length === 1 ||
                          currentFilteredPosition ===
                            filteredQuestions.length - 1
                        }
                        className={outlineButtonClass}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-slate-800 bg-[#0D1324] p-6">
              <h2 className="text-xl font-bold text-white">Final PDF</h2>

              <p className="mt-2 text-sm text-slate-400">
                You can generate the PDF anytime. Questions without answers will
                be marked as “Not answered yet.” You can download it or open it
                for printing.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={generatePdf}
                  className={`${primaryButtonClass} px-5 py-3`}
                >
                  Download PDF
                </button>

                <button
                  onClick={printPdf}
                  className={`${outlineButtonClass} px-5 py-3`}
                >
                  Print PDF
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}