import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
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
    expect(pill).toHaveAttribute("data-target-width", "200");
    expect(pill).toHaveAttribute("data-target-height", "32");
  });

  it("expands to 620x190 when clicked and collapses on Escape", () => {
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);
    const pill = screen.getByTestId("lumen-island-pill");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("data-state", "expanded");
    expect(pill).toHaveAttribute("data-target-width", "620");
    expect(pill).toHaveAttribute("data-target-height", "190");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(pill).toHaveAttribute("data-state", "idle");
  });

  it("supports live Notch <-> Pill morph toggle inside expanded header", async () => {
    render(<App />);
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-shape", "notch");

    fireEvent.click(pill);
    fireEvent.click(await screen.findByRole("button", { name: "Pill" }));
    expect(pill).toHaveAttribute("data-shape", "pill");
  });

  it("marks the island aria-hidden and pointer-events-none when hidden", () => {
    useIslandStore.setState({ ...INITIAL_ISLAND_CONTEXT, state: "hidden" });
    render(<IslandShell />);
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-state", "hidden");
    expect(pill).toHaveAttribute("aria-hidden", "true");
  });
});
