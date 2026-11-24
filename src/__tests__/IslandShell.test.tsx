import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { IslandShell } from "../app/IslandShell";
import { INITIAL_ISLAND_CONTEXT, useIslandStore } from "../app/stateMachine";

describe("IslandShell", () => {
  beforeEach(() => {
    useIslandStore.setState(INITIAL_ISLAND_CONTEXT);
  });

  it("renders the top-centre 200x32 black pill in idle state", () => {
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-state", "idle");
    expect(pill).toHaveStyle({ width: "200px", height: "32px" });
  });

  it("expands to 620x190 when clicked", () => {
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);
    const pill = screen.getByTestId("lumen-island-pill");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("data-state", "expanded");
    expect(pill).toHaveAttribute("data-target-width", "620");
    expect(pill).toHaveAttribute("data-target-height", "190");
  });

  it("renders null when hidden", () => {
    useIslandStore.setState({ ...INITIAL_ISLAND_CONTEXT, state: "hidden" });
    render(<IslandShell />);
    expect(screen.queryByTestId("lumen-island-pill")).not.toBeInTheDocument();
  });
});
