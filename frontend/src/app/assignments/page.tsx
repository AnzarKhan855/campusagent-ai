"use client";

import AssignmentsPanel from "@/components/AssignmentsPanel";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AssignmentsPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("campusagent_token");

    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-[#020617] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          ← Back to Dashboard
        </button>

        <AssignmentsPanel />
      </div>
    </main>
  );
}