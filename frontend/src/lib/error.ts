/**
 * Safely extracts a clean, human-readable error message from API responses or unknown errors.
 *
 * Handles:
 * - Direct strings
 * - JavaScript Error instances
 * - FastAPI standard error responses: { detail: "error text" }
 * - FastAPI 422 validation error arrays: { detail: [{ loc: ["body", "password"], msg: "..." }] }
 * - Nested objects: { detail: { message: "..." } }
 * - Generic error formats: { message: "..." } or { error: "..." }
 *
 * Guarantees a string return value that will never crash `.toLowerCase()` or JSX rendering.
 */
export function extractErrorMessage(
  data: unknown,
  fallback = "An unexpected error occurred"
): string {
  if (!data) return fallback;

  // 1. Direct string
  if (typeof data === "string") {
    const trimmed = data.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  // 2. JavaScript Error instance
  if (data instanceof Error) {
    const msg = data.message.trim();
    return msg.length > 0 ? msg : fallback;
  }

  // 3. Objects (API JSON response bodies)
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;

    // 3a. FastAPI "detail"
    if ("detail" in record && record.detail !== undefined && record.detail !== null) {
      const detail = record.detail;

      // detail is string
      if (typeof detail === "string") {
        const trimmed = detail.trim();
        if (trimmed.length > 0) return trimmed;
      }

      // detail is array (FastAPI 422 validation errors)
      if (Array.isArray(detail) && detail.length > 0) {
        const messages: string[] = [];

        for (const item of detail) {
          if (typeof item === "string" && item.trim()) {
            messages.push(item.trim());
          } else if (typeof item === "object" && item !== null) {
            const err = item as Record<string, unknown>;
            const msg = typeof err.msg === "string" ? err.msg.trim() : null;
            if (msg) {
              const loc = Array.isArray(err.loc)
                ? err.loc.filter((part) => part !== "body").join(".")
                : "";
              messages.push(loc ? `${loc}: ${msg}` : msg);
            } else if (typeof err.message === "string" && err.message.trim()) {
              messages.push(err.message.trim());
            }
          }
        }

        if (messages.length > 0) {
          return messages.join("; ");
        }
      }

      // detail is an object
      if (typeof detail === "object") {
        const detailObj = detail as Record<string, unknown>;
        if (typeof detailObj.message === "string" && detailObj.message.trim()) {
          return detailObj.message.trim();
        }
        if (typeof detailObj.msg === "string" && detailObj.msg.trim()) {
          return detailObj.msg.trim();
        }
        if (typeof detailObj.error === "string" && detailObj.error.trim()) {
          return detailObj.error.trim();
        }
      }
    }

    // 3b. Generic "message" property
    if (typeof record.message === "string") {
      const trimmed = record.message.trim();
      if (trimmed.length > 0) return trimmed;
    }

    // 3c. Generic "error" property
    if (typeof record.error === "string") {
      const trimmed = record.error.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }

  return fallback;
}
