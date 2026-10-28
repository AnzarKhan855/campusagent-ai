/**
 * Centralized API base URL resolver.
 * Priority:
 * 1. NEXT_PUBLIC_API_BASE_URL
 * 2. NEXT_PUBLIC_API_URL
 * 3. Default "http://127.0.0.1:8000"
 * Trims trailing slashes to guarantee clean endpoint concatenation.
 */
export function getApiBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";
  return url.trim().replace(/\/+$/, "");
}
