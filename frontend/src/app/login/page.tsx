"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("anzar@test.com");
  const [password, setPassword] = useState("12345678");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed");
        return;
      }

      localStorage.setItem("campusagent_token", data.access_token);
      localStorage.setItem("campusagent_user", JSON.stringify(data.user));

      setMessage("Login successful");
      router.push("/dashboard");
    } catch (error) {
      setMessage("Something went wrong. Please check backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#312e81_0,#111827_34%,#020617_78%)] px-4 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-120px] top-[-120px] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-[-100px] bottom-[-120px] h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute right-20 top-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/30 to-emerald-500/20 text-2xl font-black shadow-lg">
            ⚡
          </div>

          <h1 className="text-4xl font-black tracking-tight">
            Welcome Back
          </h1>

          <p className="mt-2 text-slate-400">
            Login to your academic command center
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">
              Email
            </label>

            <input
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">
              Password
            </label>

            <input
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 py-3 font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:scale-[1.02] hover:shadow-emerald-950/30 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.toLowerCase().includes("successful")
                ? "text-emerald-300"
                : "text-red-300"
            }`}
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <a
            href="/signup"
            className="font-bold text-emerald-300 underline underline-offset-4 transition hover:text-emerald-200"
          >
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}