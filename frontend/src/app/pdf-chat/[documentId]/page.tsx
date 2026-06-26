"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  FileText,
  Library,
  MessageSquareText,
  Send,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Source = {
  filename: string;
  document_id?: string;
  chunk_number?: number;
  chunk_index?: number;
  preview: string;
  score?: number;
};

type RagDocument = {
  id: string;
  filename: string;
  original_filename: string;
  chunks_created: number;
  created_at: string;
};

export default function PdfChatPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<RagDocument | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [message, setMessage] = useState("");

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  async function fetchDocument() {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setMessage("");

      const res = await fetch(`${API_BASE}/api/rag/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch PDF");
      }

      const foundDocument = (data.documents || []).find(
        (doc: RagDocument) => doc.id === documentId
      );

      if (!foundDocument) {
        setMessage("PDF not found in your library.");
        return;
      }

      setDocument(foundDocument);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load PDF.");
    } finally {
      setLoadingDocument(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) {
      setMessage("Please enter a question.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setAnswer("");
      setSources([]);

      const res = await fetch(`${API_BASE}/api/rag/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question,
          document_id: documentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Question failed");
      }

      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/pdf-library")}
          className="mb-6 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to PDF Library
        </button>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                AI Study Chat
              </p>

              <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-white">
                {loadingDocument
                  ? "Loading PDF..."
                  : document?.filename || "PDF Chat"}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Ask questions directly from this selected PDF using RAG-powered
                semantic retrieval and source chunks.
              </p>

              {document && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-semibold text-slate-300">
                    Chunks: {document.chunks_created}
                  </span>

                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 font-semibold text-slate-300">
                    Uploaded:{" "}
                    {new Date(document.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/pdf-library")}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                <Library className="h-4 w-4" />
                PDF Library
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Dashboard
              </button>
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

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
                <Brain className="h-6 w-6" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Ask AI</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Ask a specific question from this document.
                </p>
              </div>
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: Explain this topic in simple language"
              className="mt-5 min-h-36 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <button
              onClick={handleAsk}
              disabled={loading || loadingDocument}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {loading ? "Thinking..." : "Ask AI"}
            </button>
          </div>

          {answer && (
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <h2 className="text-xl font-bold text-white">AI Answer</h2>
              </div>

              <p className="whitespace-pre-line text-sm leading-7 text-slate-300">
                {answer}
              </p>
            </section>
          )}

          {sources.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>

                <h2 className="text-xl font-bold text-white">
                  Source Citations
                </h2>
              </div>

              <div className="grid gap-4">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <p className="font-semibold text-blue-300">
                      {source.filename} · Chunk{" "}
                      {source.chunk_number ?? source.chunk_index ?? index + 1}
                    </p>

                    {source.score !== undefined && (
                      <p className="mt-1 text-xs text-slate-500">
                        Similarity Score: {source.score.toFixed(4)}
                      </p>
                    )}

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {source.preview}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}