import { vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { AuthResult } from "../lib/auth-service";

/** Header the harness uses to hand a test user's claims to the stubbed `requireAuth`. */
export const TEST_AUTH_HEADER = "x-test-auth";

/**
 * Stand-in for `requireAuth`. The real middleware verifies a Cognito JWT and
 * sets `req.user` to the resulting claims; here the claims arrive pre-verified
 * as JSON in a request header. Requests without the header still get 401 so
 * unauthenticated paths can be exercised too.
 */
export function stubRequireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") return next();

  const raw = req.headers[TEST_AUTH_HEADER];
  if (typeof raw !== "string") {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  (req as any).user = JSON.parse(raw) as AuthResult;
  next();
}

// The real module builds a Cognito verifier at import time (needs COGNITO_* env),
// so replace it wholesale rather than partially mocking it.
vi.mock("../middlewares/auth", () => ({ requireAuth: stubRequireAuth }));
