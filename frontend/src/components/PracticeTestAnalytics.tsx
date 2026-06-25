"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Summary = {
  total_tests: number;
  submitted_tests: number;
  in_progress_tests: number;
  average_percentage: number;
  best_percentage: number;
  lowest_percentage: number;
  weakest_topic: string;
};

type StatusItem = {
  name: string;
  value: number;
};

type WeakTopic = {
  topic: string;
  count: number;
};

type TopicPerformance = {
  topic: string;
  attempts: number;
  average_score: number;
  average_percentage: number;
  weak_count: number;
};

type RecentTest = {
  id: string;
  title: string;
  status: string;
  total_score: number;
  max_score: number;
  percentage: number;
  questions_count: number;
  submitted_at: string;
  created_at: string;
};

type AnalyticsResponse = {
  success: boolean;
  message: string;
  summary: Summary;
  status_distribution: StatusItem[];
  weak_topics: WeakTopic[];
  topic_performance: TopicPerformance[];
  recent_tests: RecentTest[];
  score_trend: RecentTest[];
  topic_summary_table: TopicPerformance[];
};

export default function PracticeTestAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const pieColors = ["#10b981", "#f59e0b", "#6366f1", "#ef4444"];

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getToken() {
    return localStorage.getItem("campusagent_token");
  }

  function formatDate(value?: string) {
    if (!value) return "Not submitted";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString();
  }

  function shortLabel(value: string, maxLength = 14) {
    if (!value) return "Unknown";

    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength)}...`;
  }

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Please login again to view analytics.");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/practice-tests/analytics/dashboard-summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch analytics");
      }

      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-8 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 text-white">
        <p className="text-slate-300">Loading practice test analytics...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
        {error}
      </section>
    );
  }

  if (!analytics) {
    return null;
  }

  const summary = analytics.summary;

  const scoreTrendData = analytics.score_trend.map((test, index) => ({
    name: `Test ${index + 1}`,
    title: test.title,
    percentage: test.percentage,
    score: test.total_score,
    maxScore: test.max_score,
    submitted: formatDate(test.submitted_at),
  }));

  const topicPerformanceData = analytics.topic_performance
    .slice(0, 8)
    .map((item) => ({
      topic: shortLabel(item.topic),
      fullTopic: item.topic,
      average: item.average_percentage,
      attempts: item.attempts,
      weakCount: item.weak_count,
    }));

  const weakTopicData = analytics.weak_topics.slice(0, 8).map((item) => ({
    topic: shortLabel(item.topic),
    fullTopic: item.topic,
    count: item.count,
  }));

  return (
    <section className="mt-8 rounded-3xl border border-slate-800 bg-[#0D1324] p-6 text-white shadow-2xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-emerald-400">
            Practice Test Intelligence
          </p>

          <h2 className="text-3xl font-bold text-white">
            Analytics Dashboard
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Visual summary of your practice tests, weak topics, and score
            progress.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500 hover:text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20"
        >
          Refresh Analytics
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Tests"
          value={summary.total_tests}
          helper={`${summary.submitted_tests} submitted, ${summary.in_progress_tests} in progress`}
        />

        <MetricCard
          label="Average Score"
          value={`${summary.average_percentage}%`}
          helper="Across submitted tests"
        />

        <MetricCard
          label="Best Score"
          value={`${summary.best_percentage}%`}
          helper={`Lowest: ${summary.lowest_percentage}%`}
        />

        <MetricCard
          label="Weakest Topic"
          value={summary.weakest_topic}
          helper="Most repeated weak area"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Score Trend" subtitle="Recent submitted test scores">
          {scoreTrendData.length === 0 ? (
            <EmptyChart message="No submitted tests yet." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={scoreTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  name="Percentage"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Test Status" subtitle="Submitted vs in-progress tests">
          {analytics.status_distribution.every((item) => item.value === 0) ? (
            <EmptyChart message="No practice tests created yet." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analytics.status_distribution}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  label
                >
                  {analytics.status_distribution.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={pieColors[index % pieColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Topic Performance"
          subtitle="Average percentage by topic"
        >
          {topicPerformanceData.length === 0 ? (
            <EmptyChart message="No topic performance data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topicPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="topic" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="average"
                  name="Average %"
                  fill="#38bdf8"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Weak Topic Frequency" subtitle="Repeated weak areas">
          {weakTopicData.length === 0 ? (
            <EmptyChart message="No weak topics detected yet." />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weakTopicData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="topic" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#e5e7eb",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="count"
                  name="Weak Count"
                  fill="#f97316"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-[#111827] p-5">
        <h3 className="text-xl font-bold text-white">
          Pivot-Style Topic Summary
        </h3>

        <p className="mt-1 text-sm text-slate-400">
          Topic-wise attempts, average score, and weak count.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-300">
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Avg Score</th>
                <th className="px-4 py-3">Avg %</th>
                <th className="px-4 py-3">Weak Count</th>
              </tr>
            </thead>

            <tbody>
              {analytics.topic_summary_table.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-slate-400" colSpan={5}>
                    No topic summary available yet.
                  </td>
                </tr>
              ) : (
                analytics.topic_summary_table.map((item) => (
                  <tr
                    key={item.topic}
                    className="border-b border-slate-800 text-slate-200 transition hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3 font-semibold">{item.topic}</td>
                    <td className="px-4 py-3">{item.attempts}</td>
                    <td className="px-4 py-3">{item.average_score}/10</td>
                    <td className="px-4 py-3">{item.average_percentage}%</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.weak_count > 0
                            ? "bg-red-500/10 text-red-300"
                            : "bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {item.weak_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-[#111827] p-5">
        <h3 className="text-xl font-bold text-white">Recent Practice Tests</h3>

        <div className="mt-5 space-y-3">
          {analytics.recent_tests.length === 0 ? (
            <p className="text-sm text-slate-400">
              No submitted practice tests yet.
            </p>
          ) : (
            analytics.recent_tests.map((test) => (
              <div
                key={test.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0D1324] p-4"
              >
                <div>
                  <p className="font-bold text-white">{test.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Score: {test.total_score}/{test.max_score} |{" "}
                    {test.percentage}% | Questions: {test.questions_count}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted: {formatDate(test.submitted_at)}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    test.percentage >= 70
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : test.percentage >= 40
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {test.percentage}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">{value}</p>

      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#0D1324] text-sm text-slate-400">
      {message}
    </div>
  );
}