/**
 * The API reports failures as `{ error: string }`. Pull that message out of an
 * already-parsed (possibly null or malformed) body, falling back to a caller-
 * supplied generic message.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallback;
}
