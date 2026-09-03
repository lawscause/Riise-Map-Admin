import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pathway } from "@workspace/api-client-react";
import Pathways from "@/pages/Pathways";
import { renderWithProviders } from "@/test/render";

// authFetch pulls in aws-amplify; the page only uses it for the
// pathway↔program link lookups, which are irrelevant here.
vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(async () => jsonResponse([])),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** What the import route stores for a CSV row whose four list columns were blank. */
const blankListPathway: Pathway = {
  id: 7,
  name: "Blank Lists Pathway",
  description: "Imported with empty list columns",
  targetProfile: "Career changers",
  estimatedWeeks: 12,
  activeLearners: 0,
  skills: null,
  milestones: null,
  projects: null,
  readinessCriteria: null,
};

/** Routes the generated hooks' GETs by path; anything unexpected fails loudly. */
function stubApi(pathways: Pathway[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = new URL(url, "http://localhost").pathname;
      if (path === "/api/pathways") return jsonResponse(pathways);
      if (path === "/api/programs" || path === "/api/learners") return jsonResponse([]);
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
}

describe("Pathways with null list fields (F7)", () => {
  beforeEach(() => {
    stubApi([blankListPathway]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the card grid without throwing and shows the empty skills copy", async () => {
    renderWithProviders(<Pathways />);

    expect(await screen.findByText("Blank Lists Pathway")).toBeInTheDocument();
    expect(screen.getByText("No skills added yet")).toBeInTheDocument();
  });

  it("renders the detail view without throwing and shows 'None defined yet' for all four lists", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Pathways />);

    await screen.findByText("Blank Lists Pathway");
    await user.click(screen.getByRole("button", { name: /view details/i }));

    expect(await screen.findByText("Key Skills")).toBeInTheDocument();
    expect(screen.getByText("Required Milestones")).toBeInTheDocument();
    expect(screen.getByText("Recommended Projects")).toBeInTheDocument();
    expect(screen.getByText("Readiness Criteria")).toBeInTheDocument();
    expect(screen.getAllByText("None defined yet")).toHaveLength(4);
  });
});
