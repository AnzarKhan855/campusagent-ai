"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Library,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

type RagDocument = {
  id: string;
  filename: string;
  original_filename: string;
  chunks_created: number;
  qdrant_collection: string;
  created_at: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function PdfLibraryPage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newFilename, setNewFilename] = useState("");
  const [message, setMessage] = useState("");

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  async function fetchDocuments() {
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
        throw new Error(data.detail || "Failed to fetch PDFs");
      }

      setDocuments(data.documents || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to load PDF library."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(documentId: string) {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    if (!newFilename.trim()) {
      setMessage("Please enter a filename.");
      return;
    }

    try {
      setMessage("");

      const res = await fetch(
        `${API_BASE}/api/rag/documents/${documentId}/rename`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: newFilename.trim(),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Rename failed");
      }

      setRenamingId(null);
      setNewFilename("");
      setMessage("PDF renamed successfully.");
      fetchDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to rename PDF.");
    }
  }

  async function handleDelete(documentId: string) {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const confirmed = confirm("Delete this PDF from your library?");
    if (!confirmed) return;

    try {
      setMessage("");

      const res = await fetch(`${API_BASE}/api/rag/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Delete failed");
      }

      setMessage("PDF deleted successfully.");
      fetchDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete PDF.");
    }
  }

  function handleChat(documentId: string) {
    router.push(`/pdf-chat/${documentId}`);
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

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
                PDF Library
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                RAG Document Library
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage uploaded study PDFs, rename documents, delete outdated
                files, or open a dedicated AI chat for a selected PDF.
              </p>
            </div>

            <button
              onClick={() => router.push("/rag-chat")}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Upload New PDF
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

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Total PDFs"
              value={documents.length}
              description="Uploaded RAG documents"
              icon={<Library className="h-5 w-5" />}
            />

            <SummaryCard
              title="Total Chunks"
              value={documents.reduce(
                (sum, doc) => sum + (doc.chunks_created || 0),
                0
              )}
              description="Vectorized text chunks"
              icon={<FileText className="h-5 w-5" />}
            />

            <SummaryCard
              title="Chat Mode"
              value="RAG"
              description="PDF-aware AI retrieval"
              icon={<MessageSquareText className="h-5 w-5" />}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-slate-400">
              Loading PDF library...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-blue-400">
                <FileText className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-xl font-bold text-white">
                No PDFs uploaded yet
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Upload your first study PDF to start using RAG-powered chat.
              </p>

              <button
                onClick={() => router.push("/rag-chat")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Upload PDF
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-blue-500/40"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-4">
                        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400 sm:flex">
                          <FileText className="h-6 w-6" />
                        </div>

                        <div className="min-w-0">
                          {renamingId === doc.id ? (
                            <input
                              value={newFilename}
                              onChange={(e) => setNewFilename(e.target.value)}
                              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
                              placeholder="Enter new filename"
                            />
                          ) : (
                            <h2 className="break-words text-xl font-bold text-white">
                              {doc.filename}
                            </h2>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                              Chunks: {doc.chunks_created}
                            </span>

                            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-semibold text-slate-300">
                              Uploaded:{" "}
                              {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="mt-3 break-all text-xs text-slate-500">
                            Document ID: {doc.id}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleChat(doc.id)}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <MessageSquareText className="h-4 w-4" />
                        Chat
                      </button>

                      {renamingId === doc.id ? (
                        <>
                          <button
                            onClick={() => handleRename(doc.id)}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            <Save className="h-4 w-4" />
                            Save
                          </button>

                          <button
                            onClick={() => {
                              setRenamingId(null);
                              setNewFilename("");
                            }}
                            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setRenamingId(doc.id);
                            setNewFilename(doc.filename);
                          }}
                          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                          Rename
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
        {icon}
      </div>

      <p className="mt-4 text-sm text-slate-400">{title}</p>
      <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}