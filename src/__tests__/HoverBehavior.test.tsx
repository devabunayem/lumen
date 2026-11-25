import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IslandShell } from "../app/IslandShell";
import { INITIAL_ISLAND_CONTEXT, useIslandStore } from "../app/stateMachine";

describe("Hover Auto-Open, Slim Notch 5s Return, Pin & Scroll Paging", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useIslandStore.setState(INITIAL_ISLAND_CONTEXT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on hover without peek flicker, collapses to slim notch on leave, then restores normal pill after 5s", () => {
    render(<IslandShell hoverToOpen hoverReturnSeconds={5} />);
    const pill = screen.getByTestId("lumen-island-pill");

    expect(pill).toHaveAttribute("data-state", "idle");

    fireEvent.mouseEnter(pill);
    expect(pill).toHaveAttribute("data-state", "idle");
    expect(screen.queryByText("Click to open")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(pill).toHaveAttribute("data-state", "expanded");
    expect(pill).toHaveAttribute("data-target-width", "472");

    fireEvent.mouseLeave(pill);
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(pill).toHaveAttribute("data-state", "minimal");
    expect(pill).toHaveAttribute("data-slim", "true");
    expect(pill).toHaveAttribute("data-target-width", "84");
    expect(pill).toHaveAttribute("data-target-height", "12");
    expect(screen.getByTestId("lumen-slim-indicator")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(pill).toHaveAttribute("data-state", "idle");
    expect(pill).toHaveAttribute("data-slim", "false");
    expect(pill).toHaveAttribute("data-target-width", "184");
    expect(pill).toHaveAttribute("data-target-height", "30");
  });

  it("stays expanded on mouse leave when pinned or while typing inside an input", () => {
    render(<IslandShell hoverToOpen hoverReturnSeconds={5} />);
    const pill = screen.getByTestId("lumen-island-pill");

    fireEvent.mouseEnter(pill);
    act(() => {
      vi.advanceTimersByTime(70);
    });
    expect(pill).toHaveAttribute("data-state", "expanded");

    const pinBtn = screen.getByRole("button", { name: "Pin island open" });
    fireEvent.click(pinBtn);
    expect(pinBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.mouseLeave(pill);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(pill).toHaveAttribute("data-state", "expanded");

    // Unpin and switch to Todo page with a focused input (control -> music -> calendar -> todo)
    fireEvent.click(screen.getByRole("button", { name: "Unpin island" }));
    fireEvent.wheel(pill, { deltaY: 120 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.wheel(pill, { deltaY: 120 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.wheel(pill, { deltaY: 120 });
    fireEvent.click(screen.getByRole("button", { name: "Add Task" }));
    const input = pill.querySelector("input");
    expect(input).not.toBeNull();
    input?.focus();

    fireEvent.mouseLeave(pill);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(pill).toHaveAttribute("data-state", "expanded");
  });

  it("switches expanded pages on mouse wheel scroll", () => {
    render(<IslandShell hoverToOpen />);
    const pill = screen.getByTestId("lumen-island-pill");

    fireEvent.click(pill);
    expect(screen.getByText("Control")).toBeInTheDocument();

    fireEvent.wheel(pill, { deltaY: 120 });
    expect(screen.getByText("Media")).toBeInTheDocument();
  });
});
