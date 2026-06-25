"use client";

import SubjectsPanel from "@/components/SubjectsPanel";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SubjectsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("campusagent_token");

    if (!token) {
      router.push("/login");
      return;
    }

    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#312e81_0,#111827_34%,#020617_78%)] text-white">
        Loading subjects...
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#312e81_0,#111827_34%,#020617_78%)] px-6 py-8 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-[-100px] bottom-[-120px] h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute right-20 top-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-6 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-300 backdrop-blur transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-200"
        >
          ← Back to Dashboard
        </button>

        <SubjectsPanel />
      </div>
    </main>
  );
}