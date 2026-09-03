import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route } from "wouter";
import type { Learner } from "@workspace/api-client-react";
import LearnerDetail from "@/pages/LearnerDetail";
import { Toaster } from "@/components/ui/toaster";
import { authFetch } from "@/lib/auth-fetch";
import { createTestQueryClient, renderWithProviders } from "@/test/render";

// authFetch pulls in aws-amplify; mocking the module both avoids that import and
// gives us a handle on the DELETE the page issues.
vi.mock("@/lib/auth-fetch", () => ({ authFetch: vi.fn() }));

// The in-memory router is static, so navigation is observed via a spy on
// useLocation's navigate rather than by watching the URL change.
const navigate = vi.fn();
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, useLocation: () => ["/learners/42", navigate] as const };
});

const authFetchMock = vi.mocked(authFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const learner: Learner = {
  id: 42,
  name: "Ada Lovelace",
  pathway: "Data Analytics",
  program: "Cohort 3",
  coach: "Grace",
  progress: 40,
  readiness: 55,
  status: "On Track",
  lastActive: "2026-09-01",
  nextAction: "Review portfolio",
  joinDate: "2026-06-01",
  email: "ada@example.org",
};

/** Routes the generated hooks' GETs by path; anything unexpected fails loudly. */
function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = new URL(url, "http://localhost").pathname;
      if (path === "/api/learners/42") return jsonResponse(learner);
      if (path.startsWith("/api/learners/42/") || path === "/api/programs" || path === "/api/pathways") {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

/** authFetch serves the two status/link lookups on mount and the DELETE under test. */
function stubAuthFetch(onDelete: () => Promise<Response>) {
  authFetchMock.mockImplementation(async (input, init) => {
    if (init?.method === "DELETE") return onDelete();
    return jsonResponse([]);
  });
}

async function openDialogAndConfirm() {
  const user = userEvent.setup();
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  renderWithProviders(
    <>
      <Route path="/learners/:id">
        <LearnerDetail />
      </Route>
      <Toaster />
    </>,
    { route: "/learners/42", queryClient },
  );

  await screen.findByTestId("learner-name");
  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  await user.type(screen.getByPlaceholderText(/type learner name to confirm/i), learner.name);
  await user.click(screen.getByRole("button", { name: /delete learner/i }));

  return { invalidateSpy };
}

const dialogHeading = () => screen.queryByRole("heading", { name: "Delete Learner" });

describe("LearnerDetail delete (F9)", () => {
  beforeEach(() => {
    stubApi();
    navigate.mockReset();
    authFetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("on 404 stays on the page, keeps the dialog open, and toasts the server's error", async () => {
    stubAuthFetch(async () => jsonResponse({ error: "Learner not found" }, 404));

    const { invalidateSpy } = await openDialogAndConfirm();

    expect(await screen.findByText("Learner not found")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(dialogHeading()).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/learners\/42$/), { method: "DELETE" });
  });

  it("on a network failure toasts the fallback message and does not navigate", async () => {
    stubAuthFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    await openDialogAndConfirm();

    expect(await screen.findByText("Failed to delete learner")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(dialogHeading()).toBeInTheDocument();
  });

  it("on 200 invalidates the learners list and then navigates", async () => {
    stubAuthFetch(async () => jsonResponse({ success: true }));

    const { invalidateSpy } = await openDialogAndConfirm();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/learners"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["/api/learners"] });
    expect(invalidateSpy.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });
});
