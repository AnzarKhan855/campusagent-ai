"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("campusagent_token");

    if (token) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070A12] text-white">
      <div className="rounded-3xl border border-slate-800 bg-[#0D1324] p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold text-emerald-400">
          CampusAgent AI
        </p>
        <h1 className="mt-2 text-2xl font-bold">Redirecting...</h1>
        <p className="mt-2 text-sm text-slate-400">
          Opening your student dashboard.
        </p>
      </div>
    </main>
  );
}