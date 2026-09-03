import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import { renderWithProviders } from "@/test/render";

describe("StatusBadge", () => {
  it("renders the status label", () => {
    renderWithProviders(<StatusBadge status="On Track" />);

    expect(screen.getByText("On Track")).toBeInTheDocument();
  });
});
