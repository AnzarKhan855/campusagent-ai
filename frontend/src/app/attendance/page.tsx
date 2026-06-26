"use client";

import AttendancePanel from "@/components/AttendancePanel";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function AttendancePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("campusagent_token");

    if (!token) {
      router.push("/login");
    }
  }, [router]);

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

        <AttendancePanel />
      </div>
    </main>
  );
}