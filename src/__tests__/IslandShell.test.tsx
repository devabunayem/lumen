import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { IslandShell } from "../app/IslandShell";
import { INITIAL_ISLAND_CONTEXT, useIslandStore } from "../app/stateMachine";

describe("IslandShell", () => {
  beforeEach(() => {
    useIslandStore.setState(INITIAL_ISLAND_CONTEXT);
  });

  it("renders the top-centre standard black pill in idle state", () => {
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-state", "idle");
    expect(pill).toHaveAttribute("data-target-width", "184");
    expect(pill).toHaveAttribute("data-target-height", "30");
    expect(screen.getByTestId("resting-left-indicators")).toBeInTheDocument();
    expect(screen.getByTestId("resting-center-clock")).toBeInTheDocument();
    expect(screen.getByTestId("resting-right-waveform")).toBeInTheDocument();
  });

  it("expands to Home 640x312 by default when clicked and collapses on Escape", () => {
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);
    const pill = screen.getByTestId("lumen-island-pill");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("data-state", "expanded");
    expect(pill).toHaveAttribute("data-target-width", "640");
    expect(pill).toHaveAttribute("data-target-height", "312");
    expect(screen.getByTestId("home-page")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(pill).toHaveAttribute("data-state", "idle");
  });

  it("supports live Notch <-> Pill morph toggle via header clock context menu", async () => {
    render(<App />);
    const pill = screen.getByTestId("lumen-island-pill");
    expect(pill).toHaveAttribute("data-shape", "notch");

    fireEvent.click(pill);
    fireEvent.contextMenu(await screen.findByTitle(/Toggle date & time/i));
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
