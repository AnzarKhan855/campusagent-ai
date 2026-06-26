"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Library,
  MessageSquareText,
  Send,
  UploadCloud,
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
  chunks_created: number;
};

export default function RagChatPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
          <div className="mx-auto max-w-7xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            Loading RAG Chat...
          </div>
        </main>
      }
    >
      <RagChatContent />
    </Suspense>
  );
}

function RagChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDocumentId = searchParams.get("documentId");

  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<RagDocument | null>(
    null
  );
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingAsk, setLoadingAsk] = useState(false);
  const [message, setMessage] = useState("");

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  async function fetchSelectedDocument() {
    if (!selectedDocumentId) return;

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rag/documents`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to fetch PDF library");
      }

      const foundDoc = (data.documents || []).find(
        (doc: RagDocument) => doc.id === selectedDocumentId
      );

      if (foundDoc) {
        setSelectedDocument(foundDoc);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load selected PDF."
      );
    }
  }

  useEffect(() => {
    fetchSelectedDocument();
  }, [selectedDocumentId]);

  async function handleUpload() {
    if (!file) {
      setMessage("Please select a PDF first.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoadingUpload(true);
      setMessage("");

      const res = await fetch(`${API_BASE}/api/rag/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "PDF upload failed");
      }

      const chunksCreated =
        data.document?.chunks_created ?? data.chunks_created ?? "N/A";

      setMessage(`PDF uploaded successfully. Chunks created: ${chunksCreated}`);
      setFile(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoadingUpload(false);
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
      setLoadingAsk(true);
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
          document_id: selectedDocumentId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Question failed");
      }

      setAnswer(data.answer || "");
      setSources(data.sources || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoadingAsk(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                RAG Workspace
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                AI PDF RAG Chat
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Upload PDFs, retrieve relevant chunks with semantic search, and
                ask AI questions from your study material.
              </p>
            </div>

            <button
              onClick={() => router.push("/pdf-library")}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
            >
              <Library className="h-4 w-4" />
              PDF Library
            </button>
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

          <div className="grid gap-6 lg:grid-cols-3">
            {!selectedDocumentId && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
                  <UploadCloud className="h-6 w-6" />
                </div>

                <h2 className="mt-5 text-xl font-bold text-white">
                  Upload PDF
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Add a study PDF to your RAG library.
                </p>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-5 block w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300"
                />

                <button
                  onClick={handleUpload}
                  disabled={loadingUpload}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  {loadingUpload ? "Processing..." : "Upload & Process"}
                </button>
              </div>
            )}

            <div
              className={`rounded-2xl border border-slate-800 bg-slate-950 p-5 ${
                selectedDocumentId ? "lg:col-span-3" : "lg:col-span-2"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
                  <Brain className="h-6 w-6" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedDocumentId ? "Ask Selected PDF" : "Ask PDFs"}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {selectedDocumentId
                      ? selectedDocument?.filename ||
                        "Ask questions from this selected PDF."
                      : "Ask questions across all uploaded RAG PDFs."}
                  </p>
                </div>
              </div>

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Example: Explain TCP three-way handshaking"
                className="mt-5 min-h-36 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500"
              />

              <button
                onClick={handleAsk}
                disabled={loadingAsk}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loadingAsk ? "Thinking..." : "Ask AI"}
              </button>
            </div>
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
              <h2 className="mb-4 text-xl font-bold text-white">
                Source Citations
              </h2>

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