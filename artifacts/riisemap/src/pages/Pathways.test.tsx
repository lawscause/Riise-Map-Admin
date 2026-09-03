import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pathway } from "@workspace/api-client-react";
import Pathways from "@/pages/Pathways";
import { renderWithProviders } from "@/test/render";
import { authFetch } from "@/lib/auth-fetch";

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

/**
 * F8 — the server returns `ids` positionally aligned with the request rows,
 * null for a failed row, so program links PUT to ids[i] for validRows[i]
 * instead of shifting onto the wrong pathway after any server-side failure.
 */
describe("Pathways CSV import links programs by aligned ids (F8)", () => {
  const dataProgram = { id: 42, name: "Data Science" };

  const importCsv = [
    "name,description,estimatedWeeks,programs",
    "Pathway One,First pathway,12,Data Science",
    "Pathway Two,Second pathway,12,",
    "Pathway Three,Third pathway,12,Data Science",
  ].join("\n");

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = new URL(url, "http://localhost").pathname;
        if (path === "/api/pathways") return jsonResponse([]);
        if (path === "/api/programs") return jsonResponse([dataProgram]);
        if (path === "/api/learners") return jsonResponse([]);
        throw new Error(`Unexpected fetch in test: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore the module-level default after a test installed its own router.
    vi.mocked(authFetch).mockReset();
    vi.mocked(authFetch).mockImplementation(async () => jsonResponse([]));
  });

  it("PUTs programs to ids[i] for validRows[i], skipping the failed row's null", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Pathways />);

    await user.click(await screen.findByRole("button", { name: /import csv/i }));

    // The dialog's hidden file input feeds Papa.parse; set the file directly.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File([importCsv], "pathways.csv", { type: "text/csv" })] },
    });

    await screen.findByText(/3 rows found/);

    vi.mocked(authFetch).mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = new URL(url, "http://localhost").pathname;
      if (init?.method === "POST" && path === "/api/pathways/import") {
        // Row 2 failed server-side; ids stay aligned with the three request rows.
        return jsonResponse({ imported: 2, ids: [7, null, 9], errors: [{ row: 2, message: "Invalid data" }] });
      }
      if (init?.method === "PUT" && /^\/api\/pathways\/\d+\/programs$/.test(path)) return jsonResponse({});
      throw new Error(`Unexpected authFetch in test: ${init?.method ?? "GET"} ${url}`);
    });

    await user.click(screen.getByRole("button", { name: /import 3 rows/i }));

    await waitFor(() => {
      const puts = vi.mocked(authFetch).mock.calls.filter(([, init]) => init?.method === "PUT");
      expect(puts).toHaveLength(2);
    });
    const putPaths = vi.mocked(authFetch).mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([input]) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return new URL(url, "http://localhost").pathname;
      });
    expect(putPaths).toEqual(["/api/pathways/7/programs", "/api/pathways/9/programs"]);
  });
});

